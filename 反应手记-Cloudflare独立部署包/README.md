# 反应手记：部署到你自己的 Cloudflare

这是独立部署包，不是静态页面压缩包。包含 Worker、D1 数据库、邮箱密码登录、两个页面、分析、JSON 备份与导入。原 chatgpt.site 网站未更改。

## 先做这一项：获取免费 Worker 地址

1. 登录自己的 Cloudflare，进入 Workers & Pages（Workers 和 Pages）。
2. 选择 Create application / 创建应用，选择 Hello World / 创建 Worker。
3. 名称填写 reaction-diary；若名称在自己账号内已占用，可换名称。
4. 部署后复制完整的 https://项目名.账号子域名.workers.dev 地址。

此时看到 Hello World 是正常的，只创建了入口，尚未安装本网站。不要选择“添加域名”，也不用购买域名、Pro 套餐或服务器。

## 在 Windows 上安装正式网站

准备：安装 Node.js 22.13 或以上版本，解压本包到普通文件夹。在这个文件夹中打开 PowerShell/终端。命令使用 npm.cmd，避免 PowerShell 的脚本执行策略问题。联网安装和 Cloudflare 授权可能需要你当前可用的 VPN。

先在旧网站“洞察/发现”中导出 JSON 备份，确认文件保存好。

按顺序执行，每条成功后再执行下一条：

```powershell
npm.cmd install
npm.cmd run configure
npm.cmd run login
npm.cmd run db:create
npm.cmd run db:apply
npm.cmd run set-secret
npm.cmd run deploy
```

- install：安装依赖、生成静态页面；不是发布。
- configure：粘贴前面取得的完整 Worker 地址，自动填写名称和登录域名。
- login：浏览器打开 Cloudflare 授权页，由你确认给 Wrangler 的账号访问权限。不要把账号密码或 API Token 发到聊天里。
- db:create：在你自己的账号新建 reaction-diary-data 数据库，自动绑定为 DB。只执行一次；若同名数据库已存在，先查看控制台，不要反复创建。命令还会把迁移目录设置为 drizzle。
- db:apply：把本项目的两份迁移应用到新数据库。务必确认目标是这个新数据库。
- set-secret：自动生成新的认证密钥并上传，不打印密钥。初次部署执行一次，后续更新不需要重置。
- deploy：打包并发布到前面创建的 Worker，替换 Hello World。此命令不会自动升级付费套餐。

如果账号里有多个 Cloudflare 账户，各个命令必须选择同一个账户。浏览器里的 Worker、D1 和终端授权也应属于同一个账户。

## 上线后验收

1. 打开 Worker 地址，首页应显示反应手记，洞察地址为 /insights。
2. 注册新账号、保存一条测试，退出后重新登录，确认数据仍在。
3. 用另一个浏览器登录同一账号，确认能看到测试。
4. 登录新账号后导入旧网站 JSON；确认条数和日期，再保留一份新备份。

新部署使用你自己的新数据库，旧账号密码不会自动迁移；可用原邮箱重新注册，再导入记录。未接入邮件找回服务。不要删除原网站或原备份，直到验收完成。

## 免费额度与验证边界

- workers.dev 地址无需购买独立域名。
- Cloudflare Workers Free 当前每次请求只有 10ms CPU 配额；D1 也有免费额度。
- 当前保留安全的 scrypt 密码哈希。注册、登录、改密可能触发免费 CPU 上限；本机测试不能证明符合线上免费 CPU 限制。若出现 Error 1102 或 exceeded CPU time，停止反复尝试并查看 Worker 日志，再决定是否改造认证或采用付费方案；本包不会自动升级，也没有为了免费削弱密码哈希。
- 是否需要 VPN、不同网络能否访问，需要实测；不能由免费网址保证。
- 已通过 TypeScript、14 项自动检查、Wrangler dry-run 打包、本机 D1 迁移和 HTTP 测试（注册登录、账号隔离、跨会话同步、改密、限流、页面与静态资源）。
- 尚未发布到你的账号，未验证线上免费 CPU 配额与真实手机布局。

官方文档：

- https://developers.cloudflare.com/workers/get-started/guide/
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/workers/platform/pricing/

本包不含 node_modules、本机测试数据库、旧网站账号数据、Cloudflare 授权凭据或生产密钥。源码中的 APP_ORIGIN 是待配置占位值。

## 后续更新

日常修改页面或脚本后，执行 npm.cmd run deploy 即可。不要重复创建数据库或重置认证密钥。数据库架构变更需要另行增加迁移。


## Human Benchmark 成绩回填

2026-10-30：活动时长移到常用活动下方，选活动后直接填写。桌面 Edge/Chrome 可加载 integrations/hb-helper 中的本地扩展；网页 /hb-helper-guide.html 提供安装说明，/hb-helper.zip 提供打包下载。只识别 Human Benchmark 当前最终平均成绩页，单次点击不回填；结果进入草稿，用户核对勾选后再手动保存。已有成绩先询问是否替换；切换账号、日期或编辑历史时隔离旧测试。扩展不会自动保存，也不读取账号密码。

网页与扩展协议包含启动和接收确认；网页脚本、扩展及 ZIP 通过 npm run prepare 生成/打包。npm test 覆盖客户端和扩展。真实 Edge 的完整跨标签页流程在模拟最终结果页面上通过，实际 Human Benchmark 结构依据其公开页面脚本核查；如其结构改变应手动输入。
