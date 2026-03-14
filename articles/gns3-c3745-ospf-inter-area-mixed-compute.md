---
title: "【ネスペ対策】GNS3でOSPFエリア間通信を検証する！"
emoji: "🛰️"
type: "tech"
topics: ["gns3", "ospf", "cisco", "network"]
published: true
---

## 1. はじめに

今回は local compute の Cisco ルータを使って OSPF の DR / BDR / ABR を一度に確認できる構成を自動生成します。クライアントは remote compute の Ubuntu Cloud Guest を使い、DHCP でアドレスを払い出してエリア間疎通まで確認できる形にします。

<!-- 画像候補: 検証トポロジ全体図 -->
<!-- ![](/images/gns3-ospf-inter-area/topology-overview.png) -->

## 2. 検証シナリオ

local compute の Cisco ルータ 4台で OSPF の DR / BDR / ABR を確認し、remote compute の Ubuntu クライアント同士でエリア跨ぎの疎通を確認するシナリオです。

- R1 / R2 / R3 を Area 0 の共有 Ethernet セグメントに収容し、OSPF priority で DR と BDR を固定します。
- R3 を ABR として Area 0 と Area 10 を中継し、R4 配下の Area 10 クライアントネットワークを広告します。
- Ubuntu-A と Ubuntu-B は DHCP でアドレスを取得し、最終的にエリアを跨いで相互 ping を確認します。

## 3. ノード構成

| ノード | テンプレート | メモ |
| ---- | ---- | ---- |
| SW-A0 | ethernet_switch | Area 0 の共有セグメント。R1 / R2 / R3 の DR 選出に使う。 |
| R1 | Cisco ルータ | Area 0 側の DR。Ubuntu-A のデフォルトゲートウェイも兼ねる。 |
| R2 | Cisco ルータ | Area 0 側の BDR。共有セグメント上の選出結果確認用。 |
| R3 | Cisco ルータ | Area 0 と Area 10 をつなぐ ABR。DR 選出では DROTHER に固定。 |
| R4 | Cisco ルータ | Area 10 側の内部ルータ。Ubuntu-B のデフォルトゲートウェイを配布する。 |
| Ubuntu-A | Ubuntu Cloud Guest Ubuntu 20.04 LTS (Focal Fossa) | remote compute 上のクライアント。DHCP で Area 0 側アドレスを取得させる。 |
| Ubuntu-B | Ubuntu Cloud Guest Ubuntu 20.04 LTS (Focal Fossa) | remote compute 上のクライアント。DHCP で Area 10 側アドレスを取得させる。 |

## 4. リンク構成

| 接続元 | 接続先 | ネットワーク |
| ---- | ---- | ---- |
| SW-A0 (port0) | R1 (Fa0/0) | 10.0.0.0/24 (Area 0 shared segment) |
| SW-A0 (port1) | R2 (Fa0/0) | 10.0.0.0/24 (Area 0 shared segment) |
| SW-A0 (port2) | R3 (Fa0/0) | 10.0.0.0/24 (Area 0 shared segment) |
| R3 (Fa0/1) | R4 (Fa0/0) | 10.0.34.0/30 (Area 10 transit) |
| R1 (Fa0/1) | Ubuntu-A (eth0) | 172.16.0.0/24 (Area 0 client LAN) |
| R4 (Fa0/1) | Ubuntu-B (eth0) | 172.16.10.0/24 (Area 10 client LAN) |

<!-- 画像候補: GNS3 ワークスペースのスクリーンショット -->
<!-- ![](/images/gns3-ospf-inter-area/gns3-workspace.png) -->

## 5. 初期設定コマンド例

### R1

```text
version 12.4
service timestamps debug datetime msec
service timestamps log datetime msec
no service password-encryption
hostname R1
no ip domain-lookup
ip cef
ip dhcp excluded-address 172.16.0.1 172.16.0.20
ip dhcp pool AREA0-CLIENT
network 172.16.0.0 255.255.255.0
default-router 172.16.0.1
dns-server 1.1.1.1
!
interface FastEthernet0/0
description AREA0-BROADCAST
ip address 10.0.0.1 255.255.255.0
ip ospf priority 255
no shutdown
!
interface FastEthernet0/1
description UBUNTU-A-LAN
ip address 172.16.0.1 255.255.255.0
no shutdown
!
router ospf 10
router-id 1.1.1.1
log-adjacency-changes
passive-interface default
no passive-interface FastEthernet0/0
network 10.0.0.0 0.0.0.255 area 0
network 172.16.0.0 0.0.0.255 area 0
!
line con 0
logging synchronous
line vty 0 4
login
!
end
```

### R2

```text
version 12.4
service timestamps debug datetime msec
service timestamps log datetime msec
no service password-encryption
hostname R2
no ip domain-lookup
ip cef
!
interface FastEthernet0/0
description AREA0-BROADCAST
ip address 10.0.0.2 255.255.255.0
ip ospf priority 200
no shutdown
!
interface Loopback0
ip address 2.2.2.2 255.255.255.255
!
router ospf 10
router-id 2.2.2.2
log-adjacency-changes
passive-interface default
no passive-interface FastEthernet0/0
network 10.0.0.0 0.0.0.255 area 0
network 2.2.2.2 0.0.0.0 area 0
!
line con 0
logging synchronous
line vty 0 4
login
!
end
```

### R3

```text
version 12.4
service timestamps debug datetime msec
service timestamps log datetime msec
no service password-encryption
hostname R3
no ip domain-lookup
ip cef
!
interface FastEthernet0/0
description AREA0-BROADCAST
ip address 10.0.0.3 255.255.255.0
ip ospf priority 0
no shutdown
!
interface FastEthernet0/1
description AREA10-TRANSIT-TO-R4
ip address 10.0.34.1 255.255.255.252
ip ospf network point-to-point
no shutdown
!
router ospf 10
router-id 3.3.3.3
log-adjacency-changes
passive-interface default
no passive-interface FastEthernet0/0
no passive-interface FastEthernet0/1
network 10.0.0.0 0.0.0.255 area 0
network 10.0.34.0 0.0.0.3 area 10
!
line con 0
logging synchronous
line vty 0 4
login
!
end
```

### R4

```text
version 12.4
service timestamps debug datetime msec
service timestamps log datetime msec
no service password-encryption
hostname R4
no ip domain-lookup
ip cef
ip dhcp excluded-address 172.16.10.1 172.16.10.20
ip dhcp pool AREA10-CLIENT
network 172.16.10.0 255.255.255.0
default-router 172.16.10.1
dns-server 1.1.1.1
!
interface FastEthernet0/0
description AREA10-TRANSIT-TO-R3
ip address 10.0.34.2 255.255.255.252
ip ospf network point-to-point
no shutdown
!
interface FastEthernet0/1
description UBUNTU-B-LAN
ip address 172.16.10.1 255.255.255.0
no shutdown
!
router ospf 10
router-id 4.4.4.4
log-adjacency-changes
passive-interface default
no passive-interface FastEthernet0/0
network 10.0.34.0 0.0.0.3 area 10
network 172.16.10.0 0.0.0.255 area 10
!
line con 0
logging synchronous
line vty 0 4
login
!
end
```

## 6. 検証ポイント

- R1 / R2 / R3 で `show ip ospf neighbor` を実行し、R1 が DR、R2 が BDR、R3 が DROTHER として見えることを確認します。
- R3 で `show ip ospf database summary` と `show ip route ospf` を実行し、ABR として Area 10 の経路を相互に再配布していることを確認します。
- R1 / R4 で `show ip dhcp binding` を実行し、Ubuntu-A と Ubuntu-B にアドレスが配られていることを確認します。
- Ubuntu-A と Ubuntu-B で `ip -br address` を確認し、最後に相互に `ping` を実行してエリア間通信を確認します。

<!-- 画像候補: DR / BDR / ABR の確認出力 -->
<!-- ![](/images/gns3-ospf-inter-area/show-ip-ospf-neighbor.png) -->

<!-- 画像候補: エリア間 ping の確認出力 -->
<!-- ![](/images/gns3-ospf-inter-area/inter-area-ping.png) -->

## 7. 期待する結果

- Area 0 の共有セグメントで、R1 が DR、R2 が BDR、R3 が DROTHER として安定して選出される。
- R3 が ABR として Area 0 と Area 10 のサマリ LSDB を持ち、R1 / R2 から Area 10 の 172.16.10.0/24 が学習できる。
- Ubuntu-A と Ubuntu-B が DHCP でアドレスを取得し、172.16.0.0/24 と 172.16.10.0/24 の間で疎通できる。

## 8. まとめ

Cisco ルータを使った OSPF エリア間通信のラボを自動生成し、DR / BDR / ABR の役割とクライアント疎通をまとめて確認できる構成にしました。あとは実際のキャプチャやコマンド出力を差し込むと、検証記事として完成させやすいです。
