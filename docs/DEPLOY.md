# Deployment Guide - Mask EQ Designer Web Version

## Quick Start

### Local Testing

1. Simply open `index.html` in any modern web browser:
   - Double-click the file, OR
   - Right-click → Open with → [Your Browser]

2. The application runs entirely in the browser - no server needed!

## GitHub Pages Deployment

### Option 1: Deploy from /web folder

1. **Push to GitHub:**
   ```bash
   git add web/
   git commit -m "Add web version of EQ designer"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select your main branch
   - Under "Folder", select `/web`
   - Click **Save**

3. **Access your app:**
   - GitHub will provide a URL like:
   - `https://yourusername.github.io/repositoryname/`
   - Wait a few minutes for deployment

### Option 2: Deploy to gh-pages branch (root)

If you want the app at the root URL:

1. **Create gh-pages branch with web contents:**
   ```bash
   # Copy web folder contents to a temporary location
   git checkout --orphan gh-pages
   git rm -rf .
   cp -r web/* .
   git add .
   git commit -m "Deploy web version"
   git push origin gh-pages
   git checkout main
   ```

2. **Configure GitHub Pages:**
   - Settings → Pages
   - Source: gh-pages branch
   - Folder: / (root)

3. **Your app will be at:**
   - `https://yourusername.github.io/repositoryname/`

## Other Hosting Options

### Netlify (Drag & Drop)

1. Go to [netlify.com](https://www.netlify.com/)
2. Sign up / Log in
3. Drag the entire `web` folder onto the upload area
4. Get instant URL like `https://random-name.netlify.app`
5. Optional: Configure custom domain

### Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Navigate to web folder: `cd web`
3. Run: `vercel`
4. Follow prompts

### Static Web Hosts

The web folder can be uploaded to any static hosting:
- Amazon S3 + CloudFront
- Google Cloud Storage
- Azure Static Web Apps
- Cloudflare Pages
- Render
- surge.sh

Just upload all files in the `web` folder to your hosting service.

## Files Required for Deployment

The following files **must** be included:

- ✅ `index.html` - Main application page
- ✅ `style.css` - Styling
- ✅ `eq_designer.js` - Core application logic

Optional files (for testing/documentation):
- `README.md` - Documentation
- `test_bass_filter.txt` - Sample input file
- `test_algorithm.js` - Node.js test script
- `DEPLOY.md` - This file

## Testing Before Deployment

1. **Local browser test:**
   ```bash
   # Open in browser
   open index.html  # macOS
   start index.html # Windows
   ```

2. **Algorithm verification:**
   ```bash
   # Run Node.js test (requires Node.js installed)
   node test_algorithm.js
   ```

3. **Check browser console:**
   - Open browser DevTools (F12)
   - Check Console tab for any errors
   - Should see: "Mask EQ Designer initialized"

## Troubleshooting

### Plotly not loading
- **Issue:** Plot area is blank
- **Solution:** Check internet connection (Plotly loads from CDN)
- **Offline option:** Download Plotly.js and host locally

### File upload not working
- **Issue:** "Load File" button doesn't work
- **Check:** Modern browser with File API support
- **Solution:** Use Chrome, Firefox, or Edge (latest versions)

### Export not downloading
- **Issue:** Export button doesn't create files
- **Check:** Browser popup blocker settings
- **Solution:** Allow downloads from the site

### Sliders not visible on mobile
- **Issue:** Sliders too small on phone
- **Solution:** Use landscape orientation, or zoom in

## Performance Notes

- **Initial load:** ~1-2 seconds (loading Plotly from CDN)
- **Slider updates:** Real-time (< 100ms)
- **Export time:** < 500ms for .h file generation
- **Browser memory:** ~50-100 MB typical usage

## Browser Compatibility

Tested and working on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Security Notes

- All processing is client-side (no data sent to server)
- No cookies or tracking
- No external dependencies except Plotly.js CDN
- Safe to use with sensitive EQ curves

## Customization

To customize the application, edit:

1. **`eq_designer.js`** - Change Config object:
   ```javascript
   const Config = {
       SAMPLE_RATE: 16000,    // Change sample rate
       FFT_SIZE: 256,         // Change FFT size
       NUM_BANDS: 14,         // Change number of sliders
       MIN_GAIN_DB: -18.0,    // Change slider range
       MAX_GAIN_DB: 18.0
   };
   ```

2. **`style.css`** - Change colors/layout:
   ```css
   body {
       background-color: #1a1a1a;  /* Change background */
   }
   ```

## Support

If you encounter issues:
1. Check browser console for error messages (F12)
2. Verify all files are uploaded correctly
3. Test in a different browser
4. Compare with local version

## Next Steps After Deployment

1. Test all features on the deployed version
2. Share the URL with users
3. Consider adding Google Analytics (optional)
4. Monitor browser console for any errors reported by users
