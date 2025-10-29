# Filecoin Grants Website Setup Notes

This website has been created by adapting the Optimism Grants Council site for Filecoin.

## Completed Changes

### 1. Content Updates
- Replaced all "Optimism" references with "Filecoin"
- Replaced "Growth Grants" with "Community Grants" throughout the site
- Updated social media links to Filecoin's official accounts (Twitter: @Filecoin, Telegram: https://t.me/filecoin, Discord: https://discord.gg/yeQ2hcd2TD, Github: https://github.com/filecoin-project, Slack: https://filecoin.io/slack, Forum: https://github.com/filecoin-project/community#forums)
- Updated external links to point to Filecoin domains

### 2. Branding Updates
- Primary color: `#0090ff` (Filecoin primary)
- Light color: `#79a3e6`
- Background: `#f9f9f9`
- Updated all CSS variables in `assets/scss/common/_variables-custom.scss`
- Updated navbar logo color

### 3. Configuration
- Updated `config/_default/hugo.toml` with Filecoin branding
- Updated `config/_default/params.toml` with Filecoin info
- Updated menu items in `config/_default/menus/menus.en.toml`
- Updated CNAME to `filpgf.io`

### 4. Visual Assets
- Downloaded official Filecoin favicon from Filecoin.io (`static/favicon.png`)
- Downloaded official Filecoin logo PNG from Filecoin.io (`static/apple-touch-icon.png`)
- Created "F" logo in SVG format for additional icons
- Logo colors match Filecoin brand (#f9f9f9 background, #0090ff text)

## Action Items for Manual Update

### Visual Assets Status
✅ **Downloaded from Filecoin.io:**
- `/static/apple-touch-icon.png` - Official Filecoin logo
- `/assets/favicon.png` - Copy of official Filecoin logo

✏️ **Custom SVG Placeholders:**
- `/static/icon.svg` - Placeholder "F" logo with Filecoin branding
- `/assets/favicon.svg` - Placeholder "F" logo with Filecoin branding
- `/static/Filecoin-logo.svg` - Placeholder Filecoin text logo

### Optional Improvements
1. **Replace SVG Placeholders:**
   If you have vector versions of the Filecoin logo, replace the placeholder SVG files:
   - `/static/icon.svg`
   - `/assets/favicon.svg`
   - `/static/Filecoin-logo.svg`

2. **Other Assets:**
   - `/static/karma-logo.svg` - Consider removing or replacing if not needed

### URL Updates Needed
Some placeholder URLs may need to be updated once Filecoin's grant system is live:
- Application URLs in `/layouts/home.html` currently point to Season 8 page
- Menu grant links in `/config/_default/menus/menus.en.toml`
- Grant platform URLs (currently using placeholder karma URLs)

### Testing Before Deployment
1. Install dependencies: `npm install`
2. Run local dev server: `hugo server`
3. Check all pages render correctly
4. Verify all links work
5. Test responsive design on mobile
6. Replace placeholder URLs with actual grant application URLs

## Filecoin Brand Colors Reference
- Primary: #0090ff
- Light: #79a3e6
- Dark: #1864dc
- Background: #f9f9f9
- Secondary: #595959


## Social Links
- Website: https://filecoin.io
- Twitter: @Filecoin
- Telegram: https://t.me/filecoin
- Discord: https://discord.gg/yeQ2hcd2TD
- Github: https://github.com/filecoin-project
- Slack: https://filecoin.io/slack
- Forum: https://github.com/filecoin-project/community#forums