# 胡闹运动会

一款以 React、TypeScript 和确定性规则引擎实现的怪诞竞速桌游网页原型。默认提供 36 名原创软胶玩具感 3D 角色，造型会直接呼应角色名称和能力；玩家也可在本地浏览器导入按角色 slug 命名的 ZIP 素材包，导入内容不会上传到服务器。

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。运行真实房间服务时，另开终端执行：

```bash
cp .env.example .env.local
npm run dev:rooms
```

## 验证

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run worker:check
```

## 在线房间

`worker/index.ts` 使用 Cloudflare Worker 与 Durable Object 保存权威房间状态，包含房间码、准备、房主转移、版本校验、重复指令防护、断线席位保留和 WebSocket 同步。部署前需在 Cloudflare 账户中确认 `wrangler.game.jsonc` 的 Durable Object 迁移配置。

## 素材与授权

本项目是同人规则原型，并不代表获得商业发行授权。默认角色头像、界面、程序化音效与音乐均为本项目原创；桌游名称、角色概念与规则相关权利归其各自权利人所有。公开销售或商业发布前必须另行完成授权确认。

规则实现参考项目内的规则书与 MIT 许可的 [magsim](https://github.com/pschonev/magsim)。上传的素材包只保存在用户浏览器的 IndexedDB 中。

网站字体使用 [文渊圆体](https://github.com/takushun-wu/WenYuanFonts) 的网页子集版本，字体以 SIL Open Font License 1.1 授权；许可证副本随站点保存在 `public/fonts/WenYuanRoundedSC-LICENSE.md`。
