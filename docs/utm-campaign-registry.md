# DevFest Warsaw 2026 — UTM Campaign Registry

This document is the canonical local source of truth for marketing campaign links, UTM attribution conventions, and partner referral parameters. It replaces external Google Drive spreadsheet dependencies with a version-controlled, offline-ready registry.

---

## 1. Parameter Convention & Naming Authority

All official campaign links point to `https://warsaw.devfest.pl/` and adhere to the following schema:

| Parameter | Type | Required | Allowed Values / Examples | Description |
| :--- | :--- | :---: | :--- | :--- |
| `utm_source` | string | **Yes** | `linkedin`, `instagram`, `facebook`, `newsletter`, `bevy`, `partner` | Platform or channel identifier. |
| `utm_medium` | string | **Yes** | `social`, `email`, `community`, `partner`, `cpc` | Marketing or distribution medium. |
| `utm_campaign` | string | **Yes** | `devfest_warsaw_2026` | Event campaign name. Must remain constant across all 2026 links. |
| `utm_content` | string | No | `profile_bio`, `organic_post_01`, `story_01`, `speaker_wave_1`, `ticket_launch` | Specific placement, creative, or edition. |
| `source` | string | No | `Bevy-GDG-Community`, `<PartnerName>-Referral` | Forwarded directly into Evenea registration iframe. |

> [!IMPORTANT]
> - Never include personal identifiable information (PII) such as personal names or email addresses in UTM parameters.
> - All parameters must be lowercase and use snake_case or hyphens for multi-word values.

---

## 2. Ready-to-Use Campaign Links

### Community & Social Media Channels

* **LinkedIn Bio / About:**  
  `https://warsaw.devfest.pl/?utm_source=linkedin&utm_medium=social&utm_campaign=devfest_warsaw_2026&utm_content=profile_bio`

* **LinkedIn Organic Posts:**  
  `https://warsaw.devfest.pl/?utm_source=linkedin&utm_medium=social&utm_campaign=devfest_warsaw_2026&utm_content=organic_post`

* **Instagram Bio (Link in bio):**  
  `https://warsaw.devfest.pl/?utm_source=instagram&utm_medium=social&utm_campaign=devfest_warsaw_2026&utm_content=profile_bio`

* **Instagram Stories:**  
  `https://warsaw.devfest.pl/?utm_source=instagram&utm_medium=social&utm_campaign=devfest_warsaw_2026&utm_content=story`

* **Facebook Posts & Events:**  
  `https://warsaw.devfest.pl/?utm_source=facebook&utm_medium=social&utm_campaign=devfest_warsaw_2026&utm_content=organic_post`

* **GDG Community Platform (Bevy):**  
  `https://warsaw.devfest.pl/?utm_source=bevy&utm_medium=community&utm_campaign=devfest_warsaw_2026&utm_content=event_page&source=Bevy-GDG-Community`

### Direct Marketing & Newsletters

* **GDG Warsaw Newsletter — Launch Announcement:**  
  `https://warsaw.devfest.pl/?utm_source=newsletter&utm_medium=email&utm_campaign=devfest_warsaw_2026&utm_content=launch_announcement`

* **GDG Warsaw Newsletter — Speaker Wave 1:**  
  `https://warsaw.devfest.pl/?utm_source=newsletter&utm_medium=email&utm_campaign=devfest_warsaw_2026&utm_content=speaker_wave_1`

* **GDG Warsaw Newsletter — Last Call / Agenda:**  
  `https://warsaw.devfest.pl/?utm_source=newsletter&utm_medium=email&utm_campaign=devfest_warsaw_2026&utm_content=agenda_announcement`

---

## 3. Partner & Sponsor Referral Template

When providing custom tracking links to conference partners and sponsors, use the following pattern:

```text
https://warsaw.devfest.pl/?utm_source={partner_slug}&utm_medium=partner&utm_campaign=devfest_warsaw_2026&utm_content=partner_promo&source={PartnerName}-Partner
```

### Examples:
* **Google Campus Warsaw:**  
  `https://warsaw.devfest.pl/?utm_source=google_campus&utm_medium=partner&utm_campaign=devfest_warsaw_2026&utm_content=campus_newsletter&source=Campus-Warsaw`
* **Community Partner:**  
  `https://warsaw.devfest.pl/?utm_source=women_techmakers&utm_medium=partner&utm_campaign=devfest_warsaw_2026&utm_content=wtm_social&source=WTM-Warsaw`

---

## 4. Attribution Flow Verification

1. When a visitor lands with these query parameters, `src/utils/attribution.ts` persists `utm_*` and `source` in `sessionStorage`.
2. When the user opens the registration block or selects a ticket, `src/elements/evenea-embed.ts` dynamically appends the stored attribution parameters to the Evenea iframe URL:
   `https://app.evenea.pl/event/devfestwarsaw2026/?out=1&source=event_iframe&ticket[ID]=1&utm_source=...&source=...`
3. Conversion data is mapped in Google Analytics 4 via Exploration filter: `Session campaign exactly matches devfest_warsaw_2026`.
