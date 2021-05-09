## Easy Typing Plugin
本插件可以在中英文之间自动补全空格，还有行内公式和文字之间自动补全空格。

- [ ] 行内自动格式化
	- [x] 中英文之间自动补全空格
	- [x] 行内公式和中英文之间自动补全空格
	- [x] 行内代码片段和中英文间自动补全空格
	- [ ] 行内小括号与文本的自动空格
	- [ ] 中文括号自动替换成英文的
	- [ ] 英文行首字母大写
- [ ] 快捷键/命令
	- [ ]  一键全文格式化
- [ ] 插件设置面板
	- [ ] 自定义正则表达式及其替换规则
	- [ ] 自定义规则可选启用或者关闭
	- [ ] 行内自动格式化功能可以关闭、打开
- [ ] 将本插件添加到 Obsidian 社区插件列表中
### bugs
- [x] 撤销操作出现问题==>solved


This plugin designed for better typing experience, especially for Chinese users.
- [x] inline auto formatting
  - [x] auto spacing between Chinese and English
  - [x] auto spacing between inline latex and text
  - [x] auto spacing between inline code and text
- [ ] Auto formatting for whole article 
### First time developing plugins?

Quick starting guide for new plugin devs:

- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

### Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments.
- Publish the release.

### Adding your plugin to the community plugin list

- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

### How to use

- Clone this repo.
- `npm i` or `yarn` to install dependencies
- `npm run dev` to start compilation in watch mode.

### Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

### API Documentation

See https://github.com/obsidianmd/obsidian-api
