# Quick Edit Reference

One-page cheat sheet for the most common content updates.

## 🚀 Most Common Updates

### 1. Close/Open Applications
**File:** `content/propgf/_index.md` (lines 17-18)

```yaml
hero:
  application_status: "Applications now open"  # Change to "Applications closed"
  deadline: "Application Deadline: Dec 23rd, 2025"  # Update date
```

---

### 2. Update Application Link
**File:** `content/propgf/_index.md` (line 19)

```yaml
hero:
  apply_url: "https://app.filpgf.io/programs/992/apply"  # Change URL here
```

---

### 3. Update Total Funding Amount
**File:** `content/_index.md` (lines 58-59)

```yaml
stats:
  items:
    - value: "$4M+"  # Change amount here
      label: "Total Funding"
```

---

### 4. Update Projects Funded Count
**File:** `content/_index.md` (lines 60-61)

```yaml
    - value: "100+"  # Change number here
      label: "Projects Funded"
```

---

### 5. Update Timeline Dates
**File:** `content/propgf/_index.md` (lines 54-59)

```yaml
timeline:
  batches:
    - name: "Batch 2"
      months:
        - "Oct 2025"  # Update these
        - "Nov 2025"  # Update these
        - "Dec 2025"  # Update these
```

---

### 6. Change Homepage Hero Badge
**File:** `content/_index.md` (line 16)

```yaml
hero:
  badge_text: "Open for Applications"  # Change text here
```

---

### 7. Update Program Description
**File:** `content/_index.md` (lines 35-39)

```yaml
programs:
  items:
    - title: "ProPGF Program"
      description: "Your description here..."  # Update this
```

---

### 8. Update ProPGF Intro Text
**File:** `content/propgf/_index.md` (lines 15-16)

```yaml
hero:
  intro: "We're thrilled to announce..."  # Update this
  description: "Supporting projects..."  # Update this
```

---

### 9. Update Contact Names
**File:** `content/propgf/_index.md` (line 160)

```yaml
stay_connected:
  items:
    - title: "Questions"
      description: "Reach out to <strong>Sejal</strong> or <strong>Josh</strong>"
      # Change names in quotes
```

---

### 10. Update About Filecoin Text
**File:** `content/_index.md` (lines 93-95)

```yaml
about:
  section_title: "About Filecoin"
  lead: "Filecoin is a decentralized storage network..."  # Update this
  description: "It turns cloud storage..."  # Update this
```

---

## 📋 File Quick Reference

| What to Update | File | Approx Line |
|----------------|------|-------------|
| Application status | `content/propgf/_index.md` | 17 |
| Application deadline | `content/propgf/_index.md` | 18 |
| Apply button URL | `content/propgf/_index.md` | 19 |
| Total funding stat | `content/_index.md` | 58 |
| Project count stat | `content/_index.md` | 60 |
| Timeline dates | `content/propgf/_index.md` | 54+ |
| Homepage hero badge | `content/_index.md` | 16 |
| Program descriptions | `content/_index.md` | 35+ |
| Contact names | `content/propgf/_index.md` | 160 |

---

## ⚡ Emergency Fixes

### Site is broken after my edit!
1. Go to your last commit on GitHub
2. Click the `...` menu → **Revert commit**
3. Confirm revert
4. Wait 2 minutes for site to rebuild
5. Ask a developer for help

### YAML validation failed?
1. Go to https://www.yamllint.com/
2. Paste your YAML (everything between the `---` lines)
3. Fix any errors it shows (usually indentation)
4. Try committing again

---

## 💡 Pro Tips

1. **Always use quotes** around text: `"like this"`
2. **Keep indentation** exactly the same
3. **Test one change at a time** - easier to debug
4. **Copy existing format** when adding new items
5. **Check the live site** after every change

---

## 🎯 Safe vs. Dangerous

### ✅ Safe to Edit
- Any text in quotes
- Numbers and dates
- URLs (if you're sure they're correct)
- Descriptions and titles
- List items (with dashes)

### ⚠️ Be Careful With
- Indentation (spacing)
- Icon names (must match available icons)
- Field names (the part before the `:`)

### ❌ Never Edit
- Lines with `type:`, `draft:`, `seo:`
- Template files in `layouts/` folder
- Anything outside the `---` markers

---

**Need more details?** See the full [CONTENT_EDITING_GUIDE.md](./CONTENT_EDITING_GUIDE.md)
