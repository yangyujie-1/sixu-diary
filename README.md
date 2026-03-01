# 思绪 · 语音日记 🎙️

> 一个用 AI 做的个人语音日记本 —— 语音输入、AI整理想法、每天自动总结发邮件。
> 
> 作者是一个**不会写代码的产品经理**，全程用 Claude 完成开发，从想法到上线不到 2 小时。

---

## ✨ 功能特性

- 🎙️ **语音输入** — 点击麦克风说话，自动识别转文字，支持长段录音
- ✦ **AI 整理** — 把零散想法一键整理成有条理的文字
- 📅 **日历查看** — 按日期浏览所有历史记录，有记录的日期自动标点
- 📋 **每日总结** — 每天早上 9 点自动生成前一天总结，发送到你的邮箱
- 📊 **每周总结** — 每周六早上 10 点自动生成周总结，发送到你的邮件
- ☁️ **云端存储** — 数据保存在云端，手机电脑随时访问，永不丢失
- 📱 **全端适配** — 手机、平板、电脑均可使用

---

## 🛠️ 技术栈

| 组件 | 技术 | 费用 |
|------|------|------|
| 前端 | 原生 HTML/CSS/JS | 免费 |
| 后端 API | Vercel Serverless Functions | 免费 |
| 数据库 | Upstash Redis | 免费 |
| AI 整理 | Claude API (Anthropic) | 按量付费 |
| 邮件推送 | Resend | 免费（100封/天） |
| 定时任务 | GitHub Actions | 免费 |

---

## 🚀 部署教程

### 第一步：准备账号和 Key

你需要注册以下平台（全部可用 GitHub 一键登录）：

| 平台 | 用途 | 注册链接 |
|------|------|----------|
| GitHub | 存放代码 | [github.com](https://github.com) |
| Vercel | 部署网站 | [vercel.com](https://vercel.com) |
| Upstash | 数据库 | [upstash.com](https://upstash.com) |
| Resend | 发送邮件 | [resend.com](https://resend.com) |
| Anthropic | Claude AI | [console.anthropic.com](https://console.anthropic.com) |

**① 获取 Claude API Key**
1. 打开 [console.anthropic.com](https://console.anthropic.com) → 注册登录
2. 左侧 API Keys → Create Key → 复制保存（只显示一次）
3. 需要绑定信用卡，建议充值 $5 起步

**② 获取 Resend API Key**
1. 打开 [resend.com](https://resend.com) → 注册登录
2. 左侧 API Keys → Create API Key → 复制保存
3. ⚠️ 免费版只能发邮件到**注册时用的邮箱地址**

**③ 获取 Upstash 数据库信息**
1. 打开 [upstash.com](https://upstash.com) → 注册登录
2. Create Database → 选 Redis → 地区选 `ap-northeast-1（Tokyo）`→ Create
3. 进入数据库 → 找到 REST API 区域 → 复制以下两个值：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

### 第二步：Fork 这个仓库

点击右上角 **Fork** 按钮 → Create fork，把代码复制到你自己的 GitHub 账号下。

---

### 第三步：部署到 Vercel

1. 打开 [vercel.com](https://vercel.com) → Add New Project
2. 选择你 Fork 的 `sixu-diary` 仓库 → Import
3. 点击 **Deploy**（先部署，环境变量下一步配置）
4. 部署完成后，进入项目 → Settings → Domains，记下你的固定域名（形如 `sixu-diary.vercel.app`）

---

### 第四步：配置环境变量

在 Vercel 项目 → **Settings → Environment Variables**，依次添加以下 5 个变量：

| 变量名 | 填写内容 |
|--------|---------|
| `CLAUDE_API_KEY` | 你的 Claude API Key |
| `RESEND_API_KEY` | 你的 Resend API Key |
| `EMAIL_TO` | 接收总结的邮箱（必须是注册 Resend 时用的邮箱） |
| `UPSTASH_REDIS_REST_URL` | Upstash 数据库地址 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash 数据库密钥 |

添加完成后：Deployments → 最新一条 → ⋯ → **Redeploy**

---

### 第五步：开启定时任务

找到仓库里的 `.github/workflows/cron.yml` 文件，点击编辑，把其中的域名换成你自己的 Vercel 域名：

```yaml
# 第15行和第24行，把下面的地址换成你自己的
curl -X POST https://你的域名.vercel.app/api/summary \
```

保存后，GitHub Actions 会自动：
- ⏰ **每天早上 9 点** — 生成昨日总结并发送邮件
- 📊 **每周六早上 10 点** — 生成本周总结并发送邮件

---

### 🎉 完成！

打开你的 Vercel 域名，开始记录你的第一个想法吧。

---

## 📖 使用说明

| 功能 | 操作 |
|------|------|
| 语音输入 | 点击麦克风 → 开始录音，再次点击 → 停止 |
| 文字输入 | 直接在输入框打字 |
| AI 整理 | 输入内容后点击 ✦ AI整理 |
| 保存记录 | 点击保存按钮，自动存入云端 |
| 查看历史 | 点击右侧日历中的任意日期 |
| 手动生成总结 | 点击「今日总结」或「本周总结」按钮 |

---

## ❓ 常见问题

**语音识别不工作？**
请使用 Chrome 浏览器，并确认已允许麦克风权限。Safari / Firefox 支持有限。

**保存失败 / 加载失败？**
检查 Vercel 环境变量是否填写正确，尤其是 Upstash 的 URL 和 Token。

**邮件收不到？**
Resend 免费版只能发到注册时用的邮箱，`EMAIL_TO` 必须和注册 Resend 的邮箱一致。

**定时总结没有自动触发？**
进入 GitHub 仓库 → Actions 标签，检查是否有报错，并确认 `cron.yml` 里的域名已改为你自己的。

**费用大概多少？**
除 Claude API 按用量收费外，其余全部免费。个人日常使用 Claude API 每月约 $1-3。

---

## 🙏 关于这个项目

本项目由小杨产品员提出需求，**Claude (Anthropic)** 完成全部代码开发，是一次「零代码上线完整产品」的实践。

> AI 时代，每个人都可以成为自己工具的创造者。

如果这个项目对你有帮助，欢迎点个 ⭐ Star，这是对我最大的鼓励！

如果你成功部署了，也欢迎来小红书@快乐线条小狗找我，分享你的体验～
