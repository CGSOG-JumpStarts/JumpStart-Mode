---
id: ux-design
phase: advisory
agent: ux-designer
status: draft
created: ""
updated: ""
version: "1.0.0"
approved_by: "Pending"
approval_date: ""
upstream_refs:
  - product-brief
dependencies: []
risk_level: low
owners: []
sha256: ""
---

# UI/UX Design: {{Project Name}}

> **User Interface Design, User Experience Analysis, Emotional Response Mapping, and Interaction Design**

## Metadata

| Field | Value |
|---|---|
| Project | {{Project Name}} |
| UI/UX Designer | AI UI/UX Designer Agent |
| Date | {{Date}} |
| Product Brief | `specs/product-brief.md` |

---

## 1. Persona Emotion Maps

### Persona: {{Persona Name}}

> {{Persona description from Product Brief}}

| Journey Step | Action | Emotion | Intensity (1-5) | Design Implication |
|---|---|---|---|---|
| Discovery | {{How they find the product}} | {{Emotion}} | {{1-5}} | {{What to design for}} |
| Onboarding | {{First-time setup}} | {{Emotion}} | {{1-5}} | {{Design implication}} |
| First Success | {{First valuable outcome}} | {{Emotion}} | {{1-5}} | {{Design implication}} |
| Daily Use | {{Routine tasks}} | {{Emotion}} | {{1-5}} | {{Design implication}} |
| Error / Friction | {{When things go wrong}} | {{Emotion}} | {{1-5}} | {{Design implication}} |

**Emotional Valleys** (highest priority UX fixes):
1. {{Journey step with highest negative emotion — focus design effort here}}
2. {{Second priority valley}}

> Repeat for each persona.

---

## 2. Information Architecture

### Navigation Structure

```
├── {{Top-level section 1}}
│   ├── {{Sub-section}}
│   └── {{Sub-section}}
├── {{Top-level section 2}}
│   ├── {{Sub-section}}
│   └── {{Sub-section}}
└── {{Top-level section 3}}
```

### Content Hierarchy

| Level | Content | Visibility | Notes |
|---|---|---|---|
| Primary | {{Always visible}} | Immediate | {{Why this is top-level}} |
| Secondary | {{Available on demand}} | One click | {{When the user needs it}} |
| Tertiary | {{Deep content}} | Search / browse | {{For power users}} |

### Progressive Disclosure Strategy

- **First visit**: {{What's shown to reduce cognitive load}}
- **Returning user**: {{What becomes visible after familiarity}}
- **Power user**: {{What's unlocked through expertise or settings}}

---

## 3. Interaction Patterns

### Flow: {{Primary User Flow Name}}

| Step | Action | User Input | System Feedback | Error Path |
|---|---|---|---|---|
| 1 | {{Entry point}} | {{What user does}} | {{What system shows}} | {{If something fails}} |
| 2 | {{Next step}} | | | |
| 3 | {{Completion}} | | | |

**Entry Point**: {{How the user arrives at this flow}}
**Exit Points**: {{Success state}} / {{Cancel path}} / {{Abandon recovery}}

> Repeat for each primary user flow.

---

## 4. Component Guidelines

### Forms
- **Validation**: {{Inline / On submit / Progressive}}
- **Help text**: {{Where and when to show guidance}}
- **Error messages**: {{Tone, placement, recovery actions}}

### Lists and Tables
- **Empty states**: {{What to show when no data exists}}
- **Loading**: {{Skeleton screens / Spinners / Progressive load}}
- **Pagination**: {{Infinite scroll / Pages / Load more}}

### Notifications
- **Success**: {{Style, persistence, placement}}
- **Error**: {{Style, persistence, user action required}}
- **Warning**: {{When to use, how to dismiss}}
- **Info**: {{Ephemeral or persistent}}

### Modals and Overlays
- **When to use**: {{Only for confirmations and focused tasks}}
- **When NOT to use**: {{Never for information display or navigation}}
- **Accessibility**: {{Focus trap, escape key, backdrop click}}

---

## 5. Accessibility Review

### WCAG 2.1 Level AA Compliance

| Criterion | Status | Notes |
|---|---|---|
| **Keyboard navigation** | {{Pass / Needs work / Fail}} | {{All interactive elements reachable via Tab}} |
| **Screen reader** | {{Pass / Needs work / Fail}} | {{Semantic HTML, ARIA labels, focus management}} |
| **Colour contrast** | {{Pass / Needs work / Fail}} | {{4.5:1 for text, 3:1 for large text}} |
| **Motion sensitivity** | {{Pass / Needs work / Fail}} | {{Respects prefers-reduced-motion}} |
| **Text resizing** | {{Pass / Needs work / Fail}} | {{Content readable at 200% zoom}} |
| **Cognitive load** | {{Pass / Needs work / Fail}} | {{Reading level, consistent patterns}} |

### Accessibility Recommendations

1. {{Specific recommendation with location/component}}
2. {{Specific recommendation}}
3. {{Specific recommendation}}

---

## 6. Design System Recommendations

If no existing design system, recommend established patterns:
- **Component library**: {{Recommendation with rationale}}
- **Typography scale**: {{Recommendation}}
- **Spacing system**: {{Recommendation (e.g., 4px grid)}}
- **Colour palette**: {{Guidance for accessible colours}}

---

## Phase Gate Approval

- [ ] Emotional response maps completed for all personas
- [ ] Information architecture defined with progressive disclosure
- [ ] Primary user flows documented with error paths
- [ ] Component guidelines established
- [ ] Accessibility audit completed (WCAG 2.1 AA)
- [ ] Recommendations prioritised by user impact
- **Approved by:** Pending
- **Date:** Pending

