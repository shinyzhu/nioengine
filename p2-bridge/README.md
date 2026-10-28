# nioengine P2.2 · JS Bridge 行车数据验证页

单文件车机验证页，用来回答一个问题：

> 车机浏览器有没有通过 JS Bridge 把行车数据暴露给网页？

部署路径：**`/bridge/`**

![JS Bridge 验证页 · 本地 mock](docs/bridge-mock.png)

> 截图为本地 mock 测试：模拟了 `window.NIOBridge`、`window.Android`、`window.car` 和 WKWebView handler。真车结果以页面导出 JSON 为准。

## 安全边界

- 打开页面只**枚举**全局对象、方法、属性，不调用任何桥。
- 只有点 **开始只读探测** 后，才会调用同时满足以下条件的方法：
  - 方法名以 `get / read / query / fetch / retrieve` 开头；
  - 方法名包含车辆语义（vehicle / car / speed / rpm / gear / battery / soc / range / telemetry / location / sensor…）；
  - 方法不需要参数（`function.length === 0`）；
  - 方法名不包含 set / write / start / stop / reset / update 等危险动作。
- 通用 `call() / invoke() / callHandler() / exec() / request()` 只会传入已知的 `get*` 方法名，不传控制指令。
- WebKit `messageHandlers` 只枚举，不自动 `postMessage`；需要时在“手动调用”里发送。
- 页面不会上传任何数据；导出由用户手动触发。

## 页面会探测什么

- 常见 NIO / Native / Android / JSBridge 全局对象；
- `window.WebView` 注入对象、`window.Android` 方法；
- `window.webkit.messageHandlers.*`；
- `window.chrome.webview`；
- React Native / Flutter / Cordova / uni-app 的 WebView 桥标记；
- 全局对象里名字像 bridge / nio / vehicle / car / telemetry / host 的对象；
- 桥对象内部一层 `vehicle` / `car` / `telemetry` / `data` 等嵌套对象；
- 页面收到的 `window.message` 和 `chrome.webview` Host 消息。

## 结果怎么读

| 结果 | 含义 |
|---|---|
| **已取得 N 项行车字段** | 至少一个桥返回了 speed / rpm / gear / battery / soc / range / vin 等可识别字段 |
| **桥可以调用，但未识别到字段** | 桥存在且调用成功，但返回结构不是常见字段；看原始 JSON，或手动调用其它方法 |
| **发现桥，但自动调用失败** | 桥存在，但可能需要参数、回调、权限，或方法名不同 |
| **未发现 JS Bridge** | 没有命中候选全局对象/handler；可能是没有注入、桥名未知，或车机只允许原生 SDK |

导出 JSON 包含：环境、UA、WebView 标记、桥路径、方法列表、每次调用的原始返回、解析到的字段、Host 消息、日志。

## 手动调用

自动探测未覆盖时：

1. 点选一个桥；
2. 选择 `direct` 或 `call / invoke / callHandler / exec / request`；
3. 输入方法名和 JSON 参数；
4. 可勾选“传入回调函数”；
5. 调用并查看原始返回。

> 手动模式允许你调用非 `get*` 方法，风险由操作者承担。不要调用控制车辆的方法。

## 常见情况

- **Android 注入对象**：通常直接调用 `window.Android.getVehicleInfo()` 就能拿到返回值；本页会自动尝试。
- **WKWebView `messageHandlers`**：网页只能 `postMessage`，拿不到同步返回值；需要原生侧再通过 `window.postMessage` 或自定义回调回传。本页会记录 Host 消息，但不会自动发送。
- **通用 JSBridge**：很多实现是 `bridge.call(method, params, callback)`；本页会尝试 `call("getVehicleInfo")` 等只读方法。如果要求 params/callback，请用手动调用。
- **权限**：部分车机桥需要原生授权、白名单域名或用户授权；HTTPS 页面更容易通过。

## 构建

```bash
npm run build:p2bridge     # p2-bridge/dist/index.html
npm run serve:p2bridge     # http://127.0.0.1:4178
```

完整部署：

```bash
npm run build:all
```

Cloudflare 构建后路径：

- `/` → P1
- `/p0/` → P0
- `/sensors/` → P2.0
- `/bridge/` → P2.2

## 版本

`0.1.0`
