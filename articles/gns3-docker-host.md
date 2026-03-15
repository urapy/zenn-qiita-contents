---
title: "GNS3のトポロジにDockerホストを追加した話"
emoji: "😊"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ['tech','network']
published: false
---
## 1. はじめに
GNS3上でネットワーク機器とサーバとの通信のテストをしたいなと思い、Qemuよりも軽量なDockreでLinuxベースのコンテナを起動し、ネットワーク機器とのテストが実現できるのではと思い導入してみました。

## 2. 構築環境
1. GNS3-GUI（クライアント側）
- マシン：MacBookAir(M1)
- GNS3 v2.2.45
2. GNS-Server
- マシン：ubuntu 18.04.6 LTS（仮想）
- GBS3 v2.2.45
:::message
クライアント側とサーバー側でバージョン合わせる必要あり！
:::

## 3. GBS3の設定
私はGNS3のアプライアンスのiptermというものを作成しました。
