# Content Editing Guide for FilPGF Website

This guide will help you update website content **without touching any code**. All content is now stored in easy-to-edit Markdown files with YAML configuration.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Homepage Editing](#homepage-editing)
3. [ProPGF Page Editing](#propgf-page-editing)
4. [YAML Basics](#yaml-basics)
5. [Common Tasks](#common-tasks)
6. [Important Rules](#important-rules)

---

## Getting Started

### What You Need to Know
- All website content is in **two main files**
- You edit these files using GitHub's web editor (no special software needed)
- Changes are in a format called **YAML** (like a simple list)
- The website automatically rebuilds when you save changes

### The Two Files You'll Edit

| File | What It Controls |
|------|------------------|
| `content/_index.md` | **Homepage** - Hero, programs, stats, about section |
| `content/propgf/_index.md` | **ProPGF Page** - Batch details, timeline, application info |

---

## Homepage Editing

**File:** `content/_index.md`

### Editing the Hero Section

```yaml
hero:
  badge_text: "Open for Applications"  # ← Change badge text here
  subtitle: "Join hundreds of builders..."  # ← Change subtitle here
  buttons:
    - text: "ProPGF Program"  # ← Button 1 text
      url: "/propgf"  # ← Button 1 link
    - text: "RetroPGF Program"  # ← Button 2 text
      url: "https://www.fil-retropgf.io/"  # ← Button 2 link
```

**What you can change:**
- Badge text (e.g., "Now Accepting Applications", "Applications Closed")
- Subtitle text
- Button labels
- Button URLs

### Updating Impact Statistics

```yaml
stats:
  section_title: "Building the Filecoin Ecosystem"  # ← Section heading
  items:
    - value: "$4M+"  # ← Change this number
      label: "Total Funding"  # ← Change this label
    - value: "100+"  # ← Change this number
      label: "Projects Funded"  # ← Change this label
    - value: "50+"
      label: "Countries"
    - value: "6"
      label: "Focus Areas"
```

**Example:** To update total funding to $5M:
```yaml
    - value: "$5M+"
      label: "Total Funding"
```

### Editing Program Cards

```yaml
programs:
  items:
    - title: "ProPGF Program"  # ← Card title
      description: "Milestone-based funding..."  # ← Card description
      features:  # ← Feature list (bullet points)
        - "Milestone-based payouts"
        - "Up to $4M in funding"
        - "Technical mentorship"
      button_text: "Learn More"  # ← Button text
      button_url: "/propgf"  # ← Button link
```

**To add a new feature:** Just add a new line with a dash:
```yaml
      features:
        - "Milestone-based payouts"
        - "Up to $4M in funding"
        - "Technical mentorship"
        - "Community support"  # ← New feature added
```

### Editing Focus Areas

```yaml
focus_areas:
  items:
    - title: "Developer Tools"  # ← Area name
      description: "SDKs, APIs, and infrastructure..."  # ← Description
    - title: "Research"
      description: "Technical, economic, or design research..."
```

**To update a description:**
```yaml
    - title: "Developer Tools"
      description: "Build amazing tools for the Filecoin ecosystem"  # ← New description
```

---

## ProPGF Page Editing

**File:** `content/propgf/_index.md`

### Updating Application Deadlines

```yaml
hero:
  application_status: "Applications now open"  # ← Status message
  deadline: "Application Deadline: Dec 23rd, 2025"  # ← Deadline date
  apply_url: "https://app.filpgf.io/programs/992/apply"  # ← Application link
```

**Example:** To update the deadline:
```yaml
  deadline: "Application Deadline: January 15th, 2026"  # ← Changed date
```

### Editing Focus Categories

```yaml
focus_categories:
  section_subtitle: "The General Track funds projects..."  # ← Intro text
  items:
    - title: "Tooling & Developer Ecosystem"  # ← Category name
      description: "SDKs, APIs, infrastructure..."  # ← Category description
    - title: "Research"
      description: "Technical, economic, or design research..."
```

**To update a category description:**
```yaml
    - title: "Research"
      description: "Groundbreaking research that advances Filecoin"  # ← New text
```

### Updating Timeline Dates

```yaml
timeline:
  batches:
    - name: "Batch 2"  # ← Batch name
      months:  # ← Timeline months
        - "Oct 2025"
        - "Nov 2025"
        - "Dec 2025"  # ← Change these dates
        - "Jan 2026"
        - "Feb 2026"
        - "Mar 2026"
```

**Example:** To update months for Batch 3:
```yaml
    - name: "Batch 3"
      months:
        - "May 2026"  # ← Updated
        - "June 2026"  # ← Updated
        - "July 2026"
        - "Aug 2026"
        - "Sept 2026"
```

### Updating Stay Connected Links

```yaml
stay_connected:
  items:
    - title: "Updates"  # ← Card title
      description: "For updates, join the <a href='...'>FIL ProPGF</a> telegram group."  # ← Text with link
    - title: "Questions"
      description: "Questions? Reach out to <strong>Sejal</strong> or <strong>Josh</strong> directly."
```

**To change contact names:**
```yaml
    - title: "Questions"
      description: "Questions? Reach out to <strong>Maria</strong> or <strong>Alex</strong> directly."
```

---

## YAML Basics

### What is YAML?
YAML is a simple way to organize information using indentation (spaces). Think of it like a structured list.

### Important Rules

#### 1. Indentation Matters!
**✅ CORRECT:**
```yaml
hero:
  badge_text: "Open for Applications"
  subtitle: "Join us"
```

**❌ WRONG:** (spaces don't line up)
```yaml
hero:
badge_text: "Open for Applications"
    subtitle: "Join us"
```

#### 2. Use Quotes for Text
Always put text in quotes:
```yaml
title: "This is a title"  # ✅ Good
title: This is a title    # ❌ Can cause errors
```

#### 3. Lists Use Dashes
```yaml
features:
  - "Feature one"    # ← Dash + space + text
  - "Feature two"
  - "Feature three"
```

#### 4. Comments Start with #
```yaml
title: "My Title"  # This is a comment - it won't show on the website
```

---

## Common Tasks

### Task 1: Close Applications

**File:** `content/propgf/_index.md`

**Change this:**
```yaml
hero:
  application_status: "Applications now open"
  deadline: "Application Deadline: Dec 23rd, 2025"
```

**To this:**
```yaml
hero:
  application_status: "Applications closed"
  deadline: "Next batch opens Q2 2026"
```

---

### Task 2: Update Funding Amount

**File:** `content/_index.md`

**Change this:**
```yaml
stats:
  items:
    - value: "$4M+"
      label: "Total Funding"
```

**To this:**
```yaml
stats:
  items:
    - value: "$6M+"
      label: "Total Funding"
```

---

### Task 3: Update Program Description

**File:** `content/_index.md`

**Find this:**
```yaml
programs:
  items:
    - title: "ProPGF Program"
      description: "Milestone-based funding for new projects..."
```

**Update the description:**
```yaml
programs:
  items:
    - title: "ProPGF Program"
      description: "Your new description here..."
```

---

### Task 4: Add a New Focus Area

**File:** `content/_index.md`

**Find the focus_areas section:**
```yaml
focus_areas:
  items:
    - title: "Infrastructure"
      icon: "box"
      description: "Core services essential to the Filecoin network."
```

**Add a new item at the end:**
```yaml
focus_areas:
  items:
    - title: "Infrastructure"
      icon: "box"
      description: "Core services essential to the Filecoin network."
    - title: "Education"  # ← New area
      icon: "bulb"  # ← Choose from: code, bulb, users, clock, info-circle, box
      description: "Training and educational materials for developers."  # ← Description
```

---

### Task 5: Update Timeline Note

**File:** `content/propgf/_index.md`

**Change this:**
```yaml
timeline:
  note: "<strong>Note:</strong> Dates may shift slightly..."
```

**To this:**
```yaml
timeline:
  note: "<strong>Note:</strong> Timeline is confirmed and final."
```

---

## Important Rules

### ✅ DO:
- **Keep the indentation** (spacing) exactly as it is
- **Use quotes** around all text
- **Make small changes** one at a time
- **Preview your changes** before publishing
- **Copy the format** of existing entries when adding new ones

### ❌ DON'T:
- **Don't change indentation** - it will break the site
- **Don't remove quotes** around text
- **Don't change anything above the `---` line** at the top of files
- **Don't edit icon names** unless you know the available options
- **Don't remove colons** (`:`) after field names
- **Don't change URLs** unless you're sure they're correct

### Dangerous Sections (Ask a Developer First)
These sections control layout and styling - **don't edit** unless you know what you're doing:

```yaml
seo:           # ← SEO settings
  title: "..."
  canonical: ""
  noindex: false

type: propgf   # ← Page type (don't change)
draft: false   # ← Publishing status (don't change)
```

---

## How to Edit Files on GitHub

### Method 1: GitHub Web Editor (Easiest)

1. Go to the GitHub repository: `https://github.com/show-karma/filecoin-grants`
2. Navigate to the file you want to edit:
   - For Homepage: Click `content` → `_index.md`
   - For ProPGF: Click `content` → `propgf` → `_index.md`
3. Click the **pencil icon** (✏️) in the top-right to edit
4. Make your changes in the editor
5. Scroll to bottom, add a commit message like "Update application deadline"
6. Click **"Commit changes"**
7. The website will rebuild automatically in ~2 minutes

### Method 2: Pull Request (Recommended for Important Changes)

1. Follow steps 1-4 above
2. Instead of committing directly, select **"Create a new branch"**
3. Name your branch something like `update-deadline-jan-2026`
4. Click **"Propose changes"**
5. Click **"Create pull request"**
6. Ask a developer to review before merging

---

## Testing Your Changes

### After Committing:
1. Wait 2-3 minutes for Netlify to rebuild
2. Visit your website: `https://filpgf.io`
3. Check that your changes appear correctly
4. If something looks wrong, you can revert the change (ask a developer)

### Before Committing:
- Copy your changes to a YAML validator: https://www.yamllint.com/
- If it shows errors, fix the spacing/formatting
- If it says "Valid YAML", you're good to commit!

---

## Quick Reference

### Available Icons
When adding/editing items, these icon names are available:
- `code` - Developer Tools icon
- `bulb` - Research/Ideas icon
- `users` - Community/People icon
- `clock` - Governance/Time icon
- `info-circle` - Information/UX icon
- `box` - Infrastructure/Package icon
- `plus-circle` - Add/New icon
- `lightning` - Fast/Retro icon

### File Locations
```
content/
├── _index.md              ← Homepage content
├── batches/
│   └── ...
└── propgf/
    └── _index.md          ← ProPGF page content

layouts/
├── home.html              ← Homepage template (don't edit)
└── propgf/
    └── list.html          ← ProPGF template (don't edit)
```

---

## Getting Help

### Something Broke?
1. Check the [Netlify deploy log](https://app.netlify.com) for errors
2. Look for "YAML" or "syntax" errors in the log
3. Common fix: Check your indentation and quotes
4. Ask a developer if you're stuck

### Questions?
- **YAML syntax:** https://www.yamllint.com/
- **Markdown guide:** https://www.markdownguide.org/
- **GitHub editing:** https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files

---

## Examples Gallery

### Example 1: Simple Text Update
```yaml
# Before
title: "Old Title"

# After
title: "New Title"
```

### Example 2: Update a Link
```yaml
# Before
button_url: "https://old-link.com"

# After
button_url: "https://new-link.com"
```

### Example 3: Add to a List
```yaml
# Before
features:
  - "Feature 1"
  - "Feature 2"

# After
features:
  - "Feature 1"
  - "Feature 2"
  - "Feature 3"  # Added
```

### Example 4: Update Multiple Fields
```yaml
# Before
hero:
  badge_text: "Applications Open"
  deadline: "Dec 23rd, 2025"

# After
hero:
  badge_text: "Applications Closed"
  deadline: "Opens Q2 2026"
```

---

**Last Updated:** December 2025
**Questions?** Contact your development team or open a GitHub issue.
