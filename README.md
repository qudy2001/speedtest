# Docker 网络测速网页

源码仓库：[qudy2001/speedtest](https://github.com/qudy2001/speedtest)。推送到 `main` 后，GitHub Actions 会构建并发布 `ghcr.io/qudy2001/speedtest:latest`（同时发布对应的提交 SHA 标签）。

显示访问者 IP，并测试**访问者浏览器与这台 Docker 服务器之间**的延迟、下载和上传速度。所有测试请求同源发送到本容器，不依赖第三方测速服务。

## 从 GHCR 拉取运行

```bash
docker pull ghcr.io/qudy2001/speedtest:latest
docker run -d --name speedtest --restart unless-stopped -p 3000:3000 ghcr.io/qudy2001/speedtest:latest
```

若匿名拉取提示没有权限，请在 GitHub 的 **Packages → speedtest → Package settings → Change visibility** 中将镜像设为 **Public**。仓库公开不一定使 GHCR 包自动公开。

## 从源码构建

```bash
docker compose up -d --build
```

打开 `http://服务器IP:3000`。需要让外部用户访问时，请在防火墙放行 TCP 3000，或通过已有的 HTTPS 反向代理发布。不要用 `localhost` 链接发给别人；那会指向对方自己的设备。

## 公网 IP 与反向代理

直接访问时，网页显示容器从连接中看到的 IP。Docker bridge、NAT、反向代理或 CDN 可能使这个地址变成网关或代理地址。

如果服务位于你信任的反向代理后面，并且代理**覆盖**客户端传来的 `CF-Connecting-IP`、`X-Real-IP` 和 `X-Forwarded-For`，可把 `compose.yaml` 中的 `TRUST_PROXY` 设为 `"1"`，然后重建容器。不要在代理不受信任或允许客户端直接访问容器时开启它，否则访问者可以伪造显示的 IP。建议反向代理也关闭测速路径的缓存和压缩。

## 说明

- 测速会实际传输数据，单次最多约 96 MiB（下载 64 MiB，上传 32 MiB）。慢连接测试用时会更长。
- 延迟为 8 次 HTTP 往返时间的中位数；抖动为相邻样本差的平均值。
- Mbps 为兆比特每秒；结果会受到浏览器、设备、网络、代理和服务器性能影响。
- 不保存 IP、文件或测速结果。上传数据仅在服务器内存中读取并丢弃。
