---
title: 【GNS3】CiscoとJniperを使ったVPN環境
private: false
tags:
  - network
  - gns3
  - cisco
  - juniper
  - chatgpt
updated_at: '2026-03-17T21:26:50+09:00'
id: 7a66863ab2fa4f67b85c
organization_url_name: null
---
## はじめに
本記事では、OSPFで構成されたネットワークにRIPで加入し、エンドツーエンドをL2TPで接続するシナリオを検証します。加入ルーターの片側をJuniperにすることで、異なるメーカー間でもプロトコルが合致すれば、正しく通信が可能であることを確認します。

特に重要なポイントとして、OSPFネットワークでは、加入ルーターが公布するWAN・LAN側ネットワークのうち、**LAN側ネットワークのみ**をOSPFで再配布します。このため、加入ルーターはどの地域からでも接続可能であり、たとえエンドツーエンドでアドレスが重複してもVPNを構成できることが示されます。

## トポロジ図
以下のトポロジ図に従ってネットワークを構築します。

![](https://raw.githubusercontent.com/bit-and-coffee/zenn-qiita-contents/main/images/network_vpn_practice/1.png) <!-- ここにトポロジ図を挿入 -->

## 検証手順

1. **OSPFネットワークの設定**
    - Ciscoルーター Router1, ESW, Router2 を用いてOSPFネットワークを構築します。
    - OSPFルーティングプロトコルを設定し、各ルーター間の通信を確立します。

    ```bash:Router1
    interface FastEthernet0/0
    ip address 172.16.1.1 255.255.255.0
    duplex auto
    speed auto
    !
    interface Serial0/0
    no ip address
    shutdown
    clock rate 2000000
    !
    interface FastEthernet0/1
    ip address 192.168.100.254 255.255.255.0
    duplex auto
    speed auto
    !
    router ospf 1
    log-adjacency-changes
    redistribute rip subnets route-map RIP_TO_OSPF
    network 172.16.1.0 0.0.0.255 area 0
    !
    router rip
    version 2
    redistribute ospf 1 metric 1
    network 192.168.100.0
    !
    ip forward-protocol nd
    !
    !
    no ip http server
    no ip http secure-server
    !
    !
    ip prefix-list KANYU-NW-1 seq 10 permit 192.168.1.0/24
    no cdp log mismatch duplex
    !
    !
    !
    route-map RIP_TO_OSPF permit 10
    match ip address prefix-list KANYU-NW-1
    ```

    ```bash:ESW
    interface FastEthernet1/0
    no switchport
    ip address 172.16.1.254 255.255.255.0
    duplex full
    speed 100
    !
    interface FastEthernet1/1
    no switchport
    ip address 172.16.2.254 255.255.255.0
    duplex full
    speed 100

    router ospf 1
    log-adjacency-changes
    network 172.16.1.0 0.0.0.255 area 0
    network 172.16.2.0 0.0.0.255 area 0
    ```

    ```bash:Router2
    interface FastEthernet0/0
    ip address 172.16.2.1 255.255.255.0
    duplex auto
    speed auto
    !
    interface Serial0/0
    no ip address
    shutdown
    clock rate 2000000
    !
    interface FastEthernet0/1
    ip address 192.168.100.254 255.255.255.0
    duplex auto
    speed auto
    !
    router ospf 1
    log-adjacency-changes
    redistribute rip subnets route-map RIP_TO_OSPF
    network 172.16.2.0 0.0.0.255 area 0
    !
    router rip
    version 2
    redistribute ospf 1 metric 1
    network 192.168.100.0
    !
    ip forward-protocol nd
    !
    !
    no ip http server
    no ip http secure-server
    !
    !
    ip prefix-list KANYU-NW-2 seq 10 permit 192.168.2.0/24
    no cdp log mismatch duplex
    !
    !
    !
    route-map RIP_TO_OSPF permit 10
    match ip address prefix-list KANYU-NW-2
    ```

2. **RIP・VPNルーターの追加**
    - Router3,4でOSPFネットワークにRIPで加入します。
    - WAN,LAN側ネットワークをRIPで公布します。
    - Router3は、加入・VPNを併せて設定
    - Router4はVPNのみ（JuniperルーターがOSPFネットワークとRIPで接続）
    - Juniperルーターを使用して、Ciscoルータとの接続性を検証（プロトコルさえあっていれば正しく通信されることを確認する）

    ```bash:Router3
    interface Loopback0
    ip address 192.168.1.1 255.255.255.0
    !
    interface Tunnel0
    no ip address
    !
    interface FastEthernet0/0
    ip address 192.168.100.100 255.255.255.0
    duplex auto
    speed auto
    !
    interface Serial0/0
    no ip address
    shutdown
    clock rate 2000000
    !
    interface FastEthernet0/1
    no ip address
    duplex auto
    speed auto
    xconnect 192.168.2.2 1 pw-class L2TP
    !
    router rip
    version 2
    network 192.168.1.0
    network 192.168.100.0
    ```

    ```bash:Router4
        pseudowire-class L2TP
    encapsulation l2tpv3
    ip local interface FastEthernet0/0
    !
    !
    !
    !
    !
    interface FastEthernet0/0
    ip address 192.168.2.2 255.255.255.0
    duplex auto
    speed auto
    !
    interface Serial0/0
    no ip address
    shutdown
    clock rate 2000000
    !
    interface FastEthernet0/1
    no ip address
    duplex auto
    speed auto
    xconnect 192.168.1.1 1 pw-class L2TP
    !
    ip forward-protocol nd
    ip route 0.0.0.0 0.0.0.0 192.168.2.1
    ```
3. **ルーティングテーブルの確認**
    - RIPで公布したネットワークがOSPFで再配布されていることを確認する。
    - OSPFで対向のLAN側ネットワークを学習していることを確認する。

    ```bash:Router1 Router2
        #Router1
            172.16.0.0/24 is subnetted, 2 subnets
        C       172.16.1.0 is directly connected, FastEthernet0/0
        O       172.16.2.0 [110/11] via 172.16.1.254, 00:14:48, FastEthernet0/0
        R    192.168.1.0/24 [120/1] via 192.168.100.100, 00:00:16, FastEthernet0/1
        O E2 192.168.2.0/24 [110/20] via 172.16.1.254, 00:14:48, FastEthernet0/0
        C    192.168.100.0/24 is directly connected, FastEthernet0/1
        #router2
                172.16.0.0/24 is subnetted, 2 subnets
        O       172.16.1.0 [110/11] via 172.16.2.254, 00:20:58, FastEthernet0/0
        C       172.16.2.0 is directly connected, FastEthernet0/0
        O E2 192.168.1.0/24 [110/20] via 172.16.2.254, 00:20:58, FastEthernet0/0
        R    192.168.2.0/24 [120/1] via 192.168.100.100, 00:00:13, FastEthernet0/1
        C    192.168.100.0/24 is directly connected, FastEthernet0/1
    ```

    ```bash:Router3 Juniper-Olive Router4
        #Router3
        R    172.16.0.0/16 [120/1] via 192.168.100.254, 00:00:15, FastEthernet0/0
        C    192.168.1.0/24 is directly connected, Loopback0
        R    192.168.2.0/24 [120/1] via 192.168.100.254, 00:00:15, FastEthernet0/0
        C    192.168.100.0/24 is directly connected, FastEthernet0/0
        #Juniper-Olive
        172.16.0.0/16      *[RIP/100] 00:24:08, metric 2, tag 0
                    > to 192.168.100.254 via em0.0
        192.168.1.0/24     *[RIP/100] 00:24:00, metric 2, tag 0
                    > to 192.168.100.254 via em0.0
        192.168.2.0/24     *[Direct/0] 00:24:13
                    > via em1.0
        192.168.2.1/32     *[Local/0] 00:24:13
                      Local via em1.0
        192.168.100.0/24   *[Direct/0] 00:24:14
                    > via em0.0
        192.168.100.100/32 *[Local/0] 00:24:14
                      Local via em0.0
        224.0.0.9/32       *[RIP/100] 00:24:15, metric 1
                      MultiRecv
        #Router4（VPN設定のみなので、ルーティングは上記のルーター任せ）
        C    192.168.2.0/24 is directly connected, FastEthernet0/0
        S*   0.0.0.0/0 [1/0] via 192.168.2.1
    ```

4. **L2TPでのエンドツーエンドの疎通試験**
    - JuniperとCiscoルーター間でL2TPトンネルを構築し、エンドツーエンドの通信が確率したことを確認します。
    - 端末はLinuxベースのDockerイメージ「ipterm」を使用しています。

    > ipterm は、GNS3（Graphical Network Simulator-3）環境で利用できる端末エミュレータです。軽量のLinuxベースの仮想アプライアンスとして設計されており、GNS3上でネットワークデバイスと対話するためのターミナルを提供します。具体的には、ネットワークトポロジー内で ipterm を使用して、他のネットワークデバイスと通信したり、基本的なネットワーク診断ツール（例えば ping や traceroute）を実行することが可能です。仮想環境でのネットワークシミュレーションやテストに便利なツールです。

    下図のとおりにエンドツーエンドでpingが通っていることが確認できました。また。wiresharkにて上位のルーターでL2TPv3のプロトコルが通過していることも確認できました。

    ![](https://raw.githubusercontent.com/bit-and-coffee/zenn-qiita-contents/main/images/network_vpn_practice/2.png)

    ![](https://raw.githubusercontent.com/bit-and-coffee/zenn-qiita-contents/main/images/network_vpn_practice/3.png)

## 検証結果
この設定により、OSPFとRIP間でのネットワーク再配布が正しく行われ、L2TPトンネルを介してエンドツーエンドで通信が確立できることを確認しました。WAN側ネットワークアドレスの重複があっても、問題なくVPN接続ができることが証明されました。

## 結論
異なるベンダー間（CiscoとJuniper）のルーターを使用しても、適切にプロトコルを設定すれば、正確なネットワーク通信が可能です。OSPFでの再配布により、ネットワークの柔軟性が増し、セキュアなVPN接続が簡単に構築できることが確認されました。
