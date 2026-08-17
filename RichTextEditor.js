function normalizeFamily(value) {
  return value.replace(/^["']|["']$/g, "").trim().toLowerCase();
}

function canonicalFamily(value) {
  const family = normalizeFamily(value);
  if (/^viktoria nouveau (big|medium|small)$/.test(family)) {
    return "viktoria nouveau";
  }
  return family;
}

// canonicalFamily() above merges "Viktoria Nouveau Big/Medium/Small" into
// one family, presenting the size distinction as a style choice instead.
// But each of those three is its own font file whose internal OpenType
// subfamily name is typically just "Regular" - it has no idea it's the
// "Big" one, since that distinction only exists in the CSS family name
// itself. This pulls that distinguishing word back out so it can be used
// as the style's display label instead of a generic, indistinguishable
// "Regular" repeated three times.
function familyVariantLabel(value) {
  const family = normalizeFamily(value);
  const match = family.match(/^viktoria nouveau (big|medium|small)$/);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : null;
}

function isSelectionGroup(target) {
  return !!(target && target.__feSelectionGroup);
}

function targetElements(target) {
  return isSelectionGroup(target) ? target.elements : [target];
}

function closestBlock(node, demo) {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  // Paragraphs are the actual block boundaries inside the editor. The old
  // code only looked for divs, so a selection spanning two <p>s was treated
  // as one block. More importantly, wrapping that selection in a <span>
  // produced invalid HTML (<span><p>...</p><p>...</p></span>), which every
  // browser repairs by inserting/moving paragraph breaks.
  const paragraph = el ? el.closest("p") : null;
  if (paragraph && demo.contains(paragraph)) return paragraph;

  const div = el ? el.closest("div") : null;
  return (div && demo.contains(div)) ? div : demo;
}

function collectBlocks(target, demo) {
  const blocks = new Set();

  targetElements(target).forEach(element => {
    if (!element) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      blocks.add(closestBlock(node, demo));
    }

    // The target itself may be the paragraph (or another block) and contain
    // no text nodes, e.g. an empty paragraph with the caret in it.
    if (blocks.size === 0) {
      blocks.add(closestBlock(element, demo));
    }
  });

  return blocks;
}

function wrapContentsInSpan(range) {
  const span = document.createElement("span");
  try {
    range.surroundContents(span);
  } catch (error) {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }
  return span;
}

function rangeIntersectsNode(range, node) {
  if (node === range.commonAncestorContainer) return true;
  const nodeRange = document.createRange();
  try {
    nodeRange.selectNode(node);
    return range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
           range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
  } catch {
    return false;
  }
}

function pointInsideOrAtEnd(range, node, container) {
  return container.contains(node) || node === container;
}

function makeBlockRange(sourceRange, block) {
  const blockRange = document.createRange();
  blockRange.selectNodeContents(block);

  const result = document.createRange();

  // Start: use the original start when it is inside this block; otherwise
  // start at the beginning of the block.
  if (block.contains(sourceRange.startContainer)) {
    result.setStart(sourceRange.startContainer, sourceRange.startOffset);
  } else {
    result.setStart(blockRange.startContainer, blockRange.startOffset);
  }

  // End: use the original end when it is inside this block; otherwise
  // end at the end of the block.
  if (block.contains(sourceRange.endContainer)) {
    result.setEnd(sourceRange.endContainer, sourceRange.endOffset);
  } else {
    result.setEnd(blockRange.endContainer, blockRange.endOffset);
  }

  return result;
}

function wrapSelection(range) {
  // A span may only contain phrasing content. If a selection crosses
  // paragraph boundaries, never put those <p> elements inside one span.
  // Instead, create one valid inline span inside each affected paragraph.
  const demo = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer.closest(".fe-demo")
    : range.commonAncestorContainer.parentElement?.closest(".fe-demo");

  const paragraphs = demo
    ? [...demo.querySelectorAll("p")].filter(p => rangeIntersectsNode(range, p))
    : [];

  if (paragraphs.length <= 1) {
    return wrapContentsInSpan(range);
  }

  // Work from the end towards the start so inserting spans does not disturb
  // the boundary points of ranges we have not processed yet.
  const spans = [];
  [...paragraphs].reverse().forEach(block => {
    const blockRange = makeBlockRange(range, block);
    if (!blockRange.collapsed) {
      spans.unshift(wrapContentsInSpan(blockRange));
    }
  });

  return {
    __feSelectionGroup: true,
    elements: spans
  };
}

function wrapAll(container) {
  const range = document.createRange();
  range.selectNodeContents(container);
  return wrapSelection(range);
}

function forEachTarget(target, fn) {
  targetElements(target).forEach(fn);
}

function flattenProperty(container, prop) {
  forEachTarget(container, element => {
    element.querySelectorAll("*").forEach(el => {
      el.style.setProperty(prop, "inherit");
    });
  });
}

function setTargetStyle(target, property, value) {
  forEachTarget(target, element => {
    element.style[property] = value;
  });
}

const STYLE_DEFAULTS = { fontStyle: "normal", fontWeight: "400" };

function applyStyleEntry(target, apply) {
  const combined = Object.assign({}, STYLE_DEFAULTS, apply);
  Object.keys(combined).forEach(jsProp => {
    const cssProp = jsProp.replace(/([A-Z])/g, "-$1").toLowerCase();
    flattenProperty(target, cssProp);
    setTargetStyle(target, jsProp, combined[jsProp]);
  });
}

function applyStyleToElement(el, apply) {
  const combined = Object.assign({}, STYLE_DEFAULTS, apply);
  Object.keys(combined).forEach(jsProp => {
    el.style[jsProp] = combined[jsProp];
  });
}

function roleForWeightStyle(weight, style) {
  return cssStyleFallbackLabel({ weight, style }).toLowerCase();
}

function inspectFonts(target) {
  const families = new Set();
  const styles = new Set();
  let found = false;

  targetElements(target).forEach(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      found = true;
      const computed = getComputedStyle(node.parentElement);
      families.add(computed.fontFamily.replace(/["']/g, "").trim().toLowerCase());
      styles.add(`${computed.fontStyle}|${computed.fontWeight}`);
    }
  });

  const actualFamily =
    found && families.size === 1 ? families.values().next().value : null;

  return {
    family: actualFamily ? canonicalFamily(actualFamily) : null,
    actualFamily,
    style: found && styles.size === 1 ? styles.values().next().value : null,
  };
}

function findOptionValue(options, predicate) {
  const match = options.find(predicate);
  return match ? match.value : "";
}

function parseFeatureTags(value) {
  const tags = new Set();
  if (!value || value === "normal") return tags;
  const re = /["']([a-zA-Z0-9]{4})["']\s*(-?\d+)?/g;
  let match;
  while ((match = re.exec(value))) {
    const [, tag, num] = match;
    if (num === undefined || parseInt(num, 10) !== 0) {
      tags.add(tag);
    }
  }
  return tags;
}

function buildFeatureSettings(tags) {
  return tags.size
    ? [...tags].map(tag => `"${tag}" 1`).join(", ")
    : "normal";
}

function collectRuns(target) {
  const runs = new Set();

  targetElements(target).forEach(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      runs.add(node.parentElement);
    }
  });

  return runs;
}

// CSS resolves an em-based value (letter-spacing, line-height) using the
// font-size of the element it's DECLARED on, and inherits the resulting
// absolute value as-is - a descendant with a different font-size does not
// get the em re-evaluated against its own size. So setting "1.2em" once on
// the outer wrapping span makes every run underneath share that ONE
// resolved value, breaking the em's link to each run's own size whenever
// a selection spans more than one font-size. Setting the em value directly
// on each individual run instead - rather than on their shared ancestor -
// makes CSS resolve it against THAT run's own font-size, keeping the
// em correctly linked to size per-run with no extra logic needed.
function applyEmValuePerRun(target, cssProp, emValue) {
  collectRuns(target).forEach(el => {
    el.style.setProperty(cssProp, `${emValue}em`);
  });
}

function toggleFeatureTag(target, tag, on) {
  const runs = collectRuns(target);
  runs.forEach(el => {
    const computed = getComputedStyle(el).fontFeatureSettings;
    const tags = parseFeatureTags(computed);
    if (on) {
      tags.add(tag);
    } else {
      tags.delete(tag);
    }
    el.style.setProperty("font-feature-settings", buildFeatureSettings(tags));
  });
}

// A minimal custom dropdown: tracks a value and a list of
// {value, label, previewStyle} options. The button and every popup row
// are ordinary elements with the preview font/weight/style applied as
// inline CSS - not native <option> elements - so rendering is
// consistent across browsers instead of depending on how (or whether)
// each one chooses to style native option lists.
function createFontDropdown(wrapperClass) {
  const wrapper = document.createElement("div");
  wrapper.className = "fe-dropdown " + wrapperClass;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "fe-dropdown-button";
  wrapper.appendChild(button);

  const popup = document.createElement("div");
  popup.className = "fe-dropdown-popup";
  wrapper.appendChild(popup);

  let options = [];
  let value = "";
  const listeners = [];

  function applyPreview(el, previewStyle) {
    el.style.fontFamily = (previewStyle && previewStyle.fontFamily) || "";
    el.style.fontStyle = (previewStyle && previewStyle.fontStyle) || "";
    el.style.fontWeight = (previewStyle && previewStyle.fontWeight) || "";
  }

  function render() {
    popup.innerHTML = "";
    options.forEach(opt => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "fe-dropdown-row";
      row.textContent = opt.label;
      applyPreview(row, opt.previewStyle);
      if (opt.value === value) row.classList.add("selected");
      row.addEventListener("click", () => {
        value = opt.value;
        render();
        popup.classList.remove("visible");
        listeners.forEach(fn => fn());
      });
      popup.appendChild(row);
    });
    const current = options.find(o => o.value === value);
    button.textContent = current ? current.label : "";
    applyPreview(button, current ? current.previewStyle : null);
  }

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    popup.classList.toggle("visible");
  });

  document.addEventListener("click", (e) => {
    if (popup.classList.contains("visible") && !popup.contains(e.target) && e.target !== button) {
      popup.classList.remove("visible");
    }
  });

  return {
    element: wrapper,
    get value() { return value; },
    set value(v) { value = v; render(); },
    getOptions() { return options; },
    setOptions(newOptions) { options = newOptions; render(); },
    onChange(fn) { listeners.push(fn); },
  };
}

// =====================================================================
// Font style discovery
// =====================================================================
// The style menu is built from the actual font files referenced by the
// Fontdue @font-face CSS.  The OpenType name table supplies the displayed
// style name, while the @font-face declaration supplies the CSS properties
// needed to apply that face.  This means there is no per-family style list
// to maintain in this tester.

const FONT_CSS_URLS = [
  "https://fonts.fontdue.com/farnamtype/css/leafy.css",
  "https://fonts.fontdue.com/farnamtype/css/viktoria-nouveau.css",
  "https://fonts.fontdue.com/farnamtype/css/leafy-sans.css",
];

const STYLE_CATALOG = {};

function cssUnquote(value) {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function cssURLToAbsolute(url, cssURL) {
  try {
    return new URL(cssUnquote(url), cssURL).href;
  } catch {
    return cssUnquote(url);
  }
}

function parseFontFaceBlocks(cssText, cssURL) {
  const faces = [];
  const re = /@font-face\s*\{([\s\S]*?)\}/gi;
  let match;

  while ((match = re.exec(cssText))) {
    const body = match[1];
    const get = name => {
      const m = body.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\s*([^;]+)`, "i"));
      return m ? m[1].trim() : "";
    };

    const family = cssUnquote(get("font-family"));
    const weight = get("font-weight") || "400";
    const style = cssUnquote(get("font-style")) || "normal";
    const stretch = cssUnquote(get("font-stretch"));
    const src = get("src");
    const urls = [...src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)]
      .map(m => cssURLToAbsolute(m[2], cssURL));

    if (family && urls.length) {
      faces.push({ family, weight, style, stretch, url: urls[0] });
    }
  }

  return faces;
}

function getOpenTypeName(font, nameKey) {
  const value = font && font.names && font.names[nameKey];
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en || value["en-US"] || Object.values(value)[0] || "";
}

function normaliseStyleName(name, family) {
  let label = (name || "").trim();
  if (!label) return "";

  // Some fonts put the family name into the subfamily/full-name field.
  // Remove it only when it is clearly a prefix, leaving the native
  // subfamily wording untouched.
  const familyRe = new RegExp("^" + family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+", "i");
  label = label.replace(familyRe, "");
  return label || name.trim();
}

async function readFontFaceMetadata(face) {
  // The role is derived purely from the numeric weight/style declared in
  // @font-face - computed identically for every family - so it can be used
  // to match "Bold" to "Bold" across families even when their fonts'
  // internal OpenType name-table strings are formatted inconsistently
  // (e.g. "Leafy Text Bold" vs "LeafyBanner-Bold"). `label` stays the
  // friendly, font-supplied name shown in the dropdown; `role` is only
  // for cross-family matching.
  const role = cssStyleFallbackLabel(face).toLowerCase();

  // If this face belongs to a merged family (see familyVariantLabel), fold
  // the distinguishing variant word into whatever label we end up with -
  // in front, since it's the more important distinction here (which size,
  // vs. which weight) - dropping a redundant plain "Regular" rather than
  // producing "Big Regular". If the label already IS the variant (e.g.
  // preferredSubfamily already correctly returned "Big" on its own),
  // leave it alone rather than doubling it into "Big Big".
  const variant = familyVariantLabel(face.family);
  const combineLabel = (rawLabel) => {
    if (!variant) return rawLabel;
    if (!rawLabel) return variant;
    const lower = rawLabel.toLowerCase();
    if (lower === "regular") return variant;
    if (lower === variant.toLowerCase() || lower.startsWith(variant.toLowerCase() + " ")) return rawLabel;
    return `${variant} ${rawLabel}`;
  };

  try {
    const buffer = await fetch(face.url, { mode: "cors" }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    });
    const font = opentype.parse(buffer);
    // opentype.js exposes the legacy name pair as fontFamily/fontSubfamily
    // (nameID 1/2) and the typographic ("preferred") pair as
    // preferredFamily/preferredSubfamily (nameID 16/17) - there is no
    // "subfamilyName"/"familyName" property. The preferred pair exists
    // precisely for cases like this: a family with more styles than the
    // legacy pair can express ends up with every legacy subfamily saying
    // "Regular", while the preferred pair correctly says "Big"/"Medium"/
    // "Small" under one shared "Viktoria Nouveau" family - so it's tried
    // first, falling back to the legacy pair for fonts that lack it.
    const subfamily = getOpenTypeName(font, "preferredSubfamily") || getOpenTypeName(font, "fontSubfamily");
    const fullName = getOpenTypeName(font, "fullName");
    const familyName = getOpenTypeName(font, "preferredFamily") || getOpenTypeName(font, "fontFamily");
    const label = normaliseStyleName(subfamily || fullName, familyName || face.family);

    return {
      label: combineLabel(label) || `${face.style === "italic" ? "Italic " : ""}${face.weight}`,
      role,
      apply: {
        fontFamily: `"${face.family}"`,
        fontStyle: face.style || "normal",
        fontWeight: face.weight || "400",
        ...(face.stretch ? { fontStretch: face.stretch } : {}),
      },
      family: face.family,
    };
  } catch (error) {
    console.warn("Could not read OpenType metadata for", face.url, error);
    return {
      label: combineLabel(cssStyleFallbackLabel(face)),
      role,
      apply: {
        fontFamily: `"${face.family}"`,
        fontStyle: face.style || "normal",
        fontWeight: face.weight || "400",
        ...(face.stretch ? { fontStretch: face.stretch } : {}),
      },
      family: face.family,
    };
  }
}

function cssStyleFallbackLabel(face) {
  const numeric = parseFloat(face.weight);
  const weightNames = {
    100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
    450: "News", 500: "Medium", 600: "SemiBold", 700: "Bold",
    800: "ExtraBold", 900: "Black",
  };
  let label = weightNames[numeric] || face.weight || "Regular";
  if (face.style === "italic" && label !== "Italic") label += " Italic";
  return label;
}

async function discoverFontStyles() {
  const allFaces = [];

  await Promise.all(FONT_CSS_URLS.map(async cssURL => {
    try {
      const response = await fetch(cssURL, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const cssText = await response.text();
      allFaces.push(...parseFontFaceBlocks(cssText, cssURL));
    } catch (error) {
      console.warn("Could not read font CSS", cssURL, error);
    }
  }));

  // Some foundries' CSS declares each named style TWICE: once under its
  // own unique family name ("Viktoria Nouveau Big") for direct use, and
  // again under the bare shared family name ("Viktoria Nouveau", same
  // weight/style, same underlying font file) as a convenience alias for
  // switching styles via font-weight instead. Within any canonical group
  // that has variant-suffixed declarations (see familyVariantLabel), the
  // bare/unsuffixed ones are pure duplicates for our purposes here - drop
  // them before ever fetching the font file, rather than relying on the
  // fetched label to happen to match up later. Also drop exact
  // re-declarations (same family + weight + style seen twice).
  const byCanonical = new Map();
  allFaces.forEach(face => {
    const key = canonicalFamily(face.family);
    if (!byCanonical.has(key)) byCanonical.set(key, []);
    byCanonical.get(key).push(face);
  });

  const seenFaceKeys = new Set();
  const facesToProcess = [];
  byCanonical.forEach(faces => {
    const hasVariants = faces.some(f => familyVariantLabel(f.family));
    faces.forEach(f => {
      if (hasVariants && !familyVariantLabel(f.family)) return;
      const faceKey = `${normalizeFamily(f.family)}|${f.style || "normal"}|${f.weight || "400"}`;
      if (seenFaceKeys.has(faceKey)) return;
      seenFaceKeys.add(faceKey);
      facesToProcess.push(f);
    });
  });

  const discovered = await Promise.all(facesToProcess.map(readFontFaceMetadata));

  discovered.forEach(entry => {
    const key = canonicalFamily(entry.family);
    if (!STYLE_CATALOG[key]) STYLE_CATALOG[key] = [];
    // Belt-and-suspenders: the filtering above should already prevent
    // visible duplicates, but if two genuinely different declarations
    // still resolve to the same displayed name, only keep the first.
    const duplicate = STYLE_CATALOG[key].some(opt => opt.label === entry.label);
    if (!duplicate) STYLE_CATALOG[key].push({ label: entry.label, role: entry.role, apply: entry.apply });
  });

  Object.values(STYLE_CATALOG).forEach(styles => {
    styles.sort((a, b) => {
      const aw = parseFloat(a.apply.fontWeight) || 400;
      const bw = parseFloat(b.apply.fontWeight) || 400;
      if (aw !== bw) return aw - bw;
      if (a.apply.fontStyle !== b.apply.fontStyle) {
        return a.apply.fontStyle === "normal" ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });
  });
}

const FAMILY_OPTIONS = [
  { value: '"Leafy Sans"', label: "Leafy Sans" },
  { value: '"Leafy Banner"', label: "Leafy Banner" },
  { value: '"Leafy Display"', label: "Leafy Display" },
  { value: '"Leafy Subhead"', label: "Leafy Subhead" },
  { value: '"Leafy Text"', label: "Leafy Text" },
  { value: '"Viktoria Nouveau"', label: "Viktoria Nouveau" },
].map(({ value, label }) => ({ value, label, previewStyle: { fontFamily: value } }));

const OT_FEATURES = [
  { tag: "case", label: "Case Forms" },
  { tag: "smcp", label: "Small Caps" },
  { tag: "c2sc", label: "All Small Caps" },
  { tag: "liga", label: "Standard Ligatures" },
  { tag: "dlig", label: "Discretionary Ligatures" },
  { tag: "calt", label: "Contextual Alternates" },
  { tag: "titl", label: "Titling" },
  { tag: "swsh", label: "Swashes" },
  { tag: "hist", label: "Historical Forms" },
  { tag: "onum", label: "Old-style Figures" },
  { tag: "lnum", label: "Lining Figures" },
  { tag: "pnum", label: "Proportional Figures" },
  { tag: "tnum", label: "Tabular Figures" },
  { tag: "frac", label: "Fractions" },
  { tag: "sups", label: "Superscript" },
  { tag: "sinf", label: "Scientific Inferiors" },
  { tag: "ordn", label: "Ordinals" },
  { tag: "zero", label: "Slashed Zero" },
  { tag: "ss01", label: "Stylistic Set 01" },
  { tag: "ss02", label: "Stylistic Set 02" },
  { tag: "ss03", label: "Stylistic Set 03" },
  { tag: "ss04", label: "Stylistic Set 04" },
  { tag: "ss05", label: "Stylistic Set 05" },
  { tag: "ss06", label: "Stylistic Set 06" },
  { tag: "ss07", label: "Stylistic Set 07" },
  { tag: "ss08", label: "Stylistic Set 08" },
  { tag: "ss09", label: "Stylistic Set 09" },
  { tag: "ss10", label: "Stylistic Set 10" },
  { tag: "ss11", label: "Stylistic Set 11" },
  { tag: "ss12", label: "Stylistic Set 12" },
  { tag: "ss13", label: "Stylistic Set 13" },
];

// =====================================================================
// Per-family OpenType feature menu
// =====================================================================
// Controls which OT_FEATURES checkboxes are shown for a given family -
// and what each one is labelled - independent of whether the underlying
// font glyphs actually support the feature. Keys are canonical family
// names (matching what canonicalFamily()/inspectFonts() produce -
// lowercase, no quotes, Viktoria Nouveau weight variants collapsed to
// "viktoria nouveau").
//
// Each entry in a family's list is either:
//   - a plain tag string, e.g. "smcp"          -> uses OT_FEATURES' default label
//   - an object, e.g. { tag: "smcp", label: "Petite Caps" } -> custom label for this family
// The two forms can be mixed freely within one family's array.
// Edit this list to change what shows up (and what it's called) per family.
const FAMILY_FEATURES = {
  "leafy text": [
    "liga", "dlig", "calt", "smcp", "c2sc", "case",
    "onum", "tnum", "ordn", "sinf", "titl", { tag: "ss01", label: "E Blob" },{ tag: "ss02", label: "Long s" }, { tag: "ss03", label: "Angular italic v w" }, { tag: "ss04", label: "Single-Story Italic g"  }, { tag: "ss05", label: "Bulgarian Cyrillic"  }, ],
   "leafy subhead": [
    "liga", "dlig", "calt", "smcp", "c2sc",  "case",
    "onum", "tnum", "ordn", "sinf", "titl", { tag: "ss01", label: "E Blob" },{ tag: "ss02", label: "Long s" }, { tag: "ss03", label: "Angular italic v w" }, { tag: "ss04", label: "Single-Story Italic g"  }, { tag: "ss05", label: "Bulgarian Cyrillic"  }, ],
    "leafy display": [
    "liga", "dlig", "calt", "smcp", "c2sc",  "case",
    "onum", "tnum", "ordn", "sinf", "titl", { tag: "ss01", label: "E Blob" },{ tag: "ss02", label: "Long s" }, { tag: "ss03", label: "Angular italic v w" }, { tag: "ss04", label: "Single-Story Italic g"  }, { tag: "ss05", label: "Bulgarian Cyrillic"  }, ],
    "leafy banner": [
    "liga", "dlig", "calt", "smcp", "c2sc",  "case",
    "onum", "tnum", "ordn", "sinf", "titl", { tag: "ss01", label: "E Blob" },{ tag: "ss02", label: "Long s" }, { tag: "ss03", label: "Angular italic v w" }, { tag: "ss04", label: "Single-Story Italic g"  }, { tag: "ss05", label: "Bulgarian Cyrillic"  }, ],
  "leafy sans":       ["liga", "calt", "lnum", "tnum"],
  "viktoria nouveau": [
    "liga", "dlig", "calt", "case",
     "ordn", "sinf", "titl", { tag: "ss01", label: "Standard A V W" },{ tag: "ss02", label: "Roman D" }, { tag: "ss03", label: "Lining Q" }, { tag: "ss04", label: "Single-Story a"  }, { tag: "ss05", label: "Bulgarian Cyrillic"  }, { tag: "ss06", label: "Gaelic Type"  } ],
};

const DEFAULT_LABEL_BY_TAG = Object.fromEntries(OT_FEATURES.map(f => [f.tag, f.label]));

// Normalises one FAMILY_FEATURES entry (string or {tag, label}) into a
// {tag, label} pair, falling back to OT_FEATURES' default label when a
// plain tag string is used or no label is given.
function normaliseFeatureEntry(entry) {
  if (typeof entry === "string") {
    return { tag: entry, label: DEFAULT_LABEL_BY_TAG[entry] || entry };
  }
  return { tag: entry.tag, label: entry.label || DEFAULT_LABEL_BY_TAG[entry.tag] || entry.tag };
}

// Fallback used when the selected text's family isn't in FAMILY_FEATURES
// (e.g. "Leafy Display"/"Leafy Subhead", which appear in FAMILY_OPTIONS
// but have no entry above yet). Shows every feature, default labels,
// until configured.
function featuresForFamily(family) {
  const entries = family && FAMILY_FEATURES[family]
    ? FAMILY_FEATURES[family]
    : OT_FEATURES.map(f => f.tag);
  return entries.map(normaliseFeatureEntry);
}

// =====================================================================
// Builds one instance's entire controls panel and appends it to `root`.
// =====================================================================

function buildControls(root) {
  const controls = document.createElement("div");
  controls.className = "fe-controls";

  // Row 1: size + leading + tracking sliders
  const sliderRow = document.createElement("div");
  sliderRow.className = "fe-control-row";

  const sizeLabel = document.createElement("label");
  sizeLabel.className = "fe-slider-box";
  sizeLabel.appendChild(document.createTextNode("Size"));
  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "fe-slider";
  slider.min = "10";
  slider.max = "200";
  slider.value = "20";
  sizeLabel.appendChild(slider);
  sliderRow.appendChild(sizeLabel);

  const leadingLabel = document.createElement("label");
  leadingLabel.className = "fe-slider-box";
  leadingLabel.appendChild(document.createTextNode("Leading"));
  const slider2 = document.createElement("input");
  slider2.type = "range";
  slider2.className = "fe-slider2";
  slider2.min = "1";
  slider2.max = "3";
  slider2.step = ".01";
  slider2.value = "1.2";
  leadingLabel.appendChild(slider2);
  sliderRow.appendChild(leadingLabel);

  const trackingLabel = document.createElement("label");
  trackingLabel.className = "fe-slider-box";
  trackingLabel.appendChild(document.createTextNode("Tracking"));
  const slider3 = document.createElement("input");
  slider3.type = "range";
  slider3.className = "fe-slider3";
  slider3.min = "-.05";
  slider3.max = ".2";
  slider3.step = ".005";
  slider3.value = "0";
  trackingLabel.appendChild(slider3);
  sliderRow.appendChild(trackingLabel);

  controls.appendChild(sliderRow);

  // Row 2: family, style, OpenType features, reset
  const menuRow = document.createElement("div");
  menuRow.className = "fe-control-row";

  const familyDropdown = createFontDropdown("fe-family-dropdown");
  familyDropdown.setOptions(FAMILY_OPTIONS);
  const fontField = document.createElement("div");
  fontField.className = "fe-dropdown-field";
  fontField.appendChild(document.createTextNode("Font"));
  fontField.appendChild(familyDropdown.element);
  menuRow.appendChild(fontField);

  const styleDropdown = createFontDropdown("fe-style-dropdown");
  const styleField = document.createElement("div");
  styleField.className = "fe-dropdown-field";
  styleField.appendChild(document.createTextNode("Style"));
  styleField.appendChild(styleDropdown.element);
  menuRow.appendChild(styleField);

  const otWrapper = document.createElement("div");
  otWrapper.className = "fe-ot-wrapper";
  const otFeaturesButton = document.createElement("button");
  otFeaturesButton.type = "button";
  otFeaturesButton.className = "fe-ot-button";
  otFeaturesButton.textContent = "OpenType Features";
  const otFeaturesPopup = document.createElement("div");
  otFeaturesPopup.className = "fe-ot-popup";
  otWrapper.appendChild(otFeaturesButton);
  otWrapper.appendChild(otFeaturesPopup);
  menuRow.appendChild(otWrapper);

  const ALIGN_ICONS = {
    left: '<rect x="1" y="1" width="18" height="2"/><rect x="1" y="6" width="12" height="2"/><rect x="1" y="11" width="15" height="2"/>',
    center: '<rect x="1" y="1" width="18" height="2"/><rect x="4" y="6" width="12" height="2"/><rect x="2.5" y="11" width="15" height="2"/>',
    right: '<rect x="1" y="1" width="18" height="2"/><rect x="7" y="6" width="12" height="2"/><rect x="4" y="11" width="15" height="2"/>',
    justify: '<rect x="1" y="1" width="18" height="2"/><rect x="1" y="6" width="18" height="2"/><rect x="1" y="11" width="18" height="2"/>',
  };

  const alignGroup = document.createElement("div");
  alignGroup.className = "fe-align-group";
  const alignButtons = ["left", "center", "right", "justify"].map(align => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fe-align-button";
    btn.dataset.align = align;
    btn.title = align.charAt(0).toUpperCase() + align.slice(1);
    btn.innerHTML = `<svg viewBox="0 0 20 14" width="20" height="14" fill="currentColor">${ALIGN_ICONS[align]}</svg>`;
    alignGroup.appendChild(btn);
    return btn;
  });
  menuRow.appendChild(alignGroup);

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "fe-reset-button";
  resetButton.textContent = "Reset";
  menuRow.appendChild(resetButton);

  controls.appendChild(menuRow);
  root.appendChild(controls);

  return {
    controls, slider, slider2, slider3, familyDropdown, styleDropdown,
    resetButton, otFeaturesButton, otFeaturesPopup, alignButtons,
  };
}

// =====================================================================
// Per-instance factory.
// =====================================================================

function initFontEditor(root) {
  const demo = root.querySelector(".fe-demo");
  demo.spellcheck = false;
  const {
    controls, slider, slider2, slider3, familyDropdown, styleDropdown,
    resetButton, otFeaturesButton, otFeaturesPopup, alignButtons,
  } = buildControls(root);

  const initialDemoHTML = demo.innerHTML;
  const initialSliderValue = slider.value;
  const initialSlider2Value = slider2.value;
  const initialSlider3Value = slider3.value;

  let selectedSpan = null;
  let activeContainer = demo;

  // Tracks which family's checkbox rows are currently built, so the
  // OpenType popup is only rebuilt when the family actually changes
  // (avoids losing the open/closed state or checked values otherwise).
  let currentFeatureFamily = undefined;

  // Rebuilds the OpenType feature popup's checkbox rows to match
  // whichever tags FAMILY_FEATURES lists for `family`. Called whenever
  // the active/selected text's family changes.
  function rebuildFeatureCheckboxes(family) {
    if (family === currentFeatureFamily) return;
    currentFeatureFamily = family;

    otFeaturesPopup.innerHTML = "";

    featuresForFamily(family).forEach(({ tag, label }) => {
      const row = document.createElement("label");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.tag = tag;

      const text = document.createElement("span");
      text.textContent = label;

      const tagLabel = document.createElement("span");
      tagLabel.className = "tag";
      tagLabel.textContent = tag;

      row.appendChild(checkbox);
      row.appendChild(text);
      row.appendChild(tagLabel);
      otFeaturesPopup.appendChild(row);

      checkbox.addEventListener("change", () => {
        if (!selectedSpan) {
          selectedSpan = wrapAll(activeContainer);
        }
        toggleFeatureTag(selectedSpan, tag, checkbox.checked);
        updateFontControls();
      });
    });
  }

  // Rebuilds the style dropdown's options for `familyValue` - each
  // option's previewStyle is the actual weight/style/family it applies,
  // so the popup list itself shows the real typographic result.
  function populateStyleOptions(familyValue) {
    const family = familyValue ? normalizeFamily(familyValue) : null;
    const matchedKey = family
      ? Object.keys(STYLE_CATALOG).find(key => normalizeFamily(key) === family)
      : null;
    const styles = matchedKey ? STYLE_CATALOG[matchedKey] : [];

    const previousValue = styleDropdown.value;
    const options = styles.map(({ label, role, apply }) => {
      const previewStyle = {
        fontFamily: apply.fontFamily || familyValue || "-",
        fontStyle: apply.fontStyle,
        fontWeight: apply.fontWeight,
      };
      return { value: JSON.stringify(apply), label, role, previewStyle };
    });
    styleDropdown.setOptions(options);
    styleDropdown.value = options.some(o => o.value === previousValue) ? previousValue : "-";
  }

  // Does `role` (e.g. "bold italic", derived purely from numeric
  // weight/style - see readFontFaceMetadata) exist among `styleDropdown`'s
  // CURRENT options? Matching on this canonical role - rather than each
  // font's own internal OpenType name string, which different families
  // format inconsistently - is what reliably lets "Bold" survive a switch
  // from Leafy Text to Leafy Banner even when the two families' Bold
  // faces sit at different numeric weights or the fonts name themselves
  // differently internally.
  function findRoleMatch(role) {
    if (!role) return "";
    return findOptionValue(styleDropdown.getOptions(), opt => opt.role === role);
  }

  // Does `styleKey` (e.g. "italic|700") exist as a real face among
  // `styleDropdown`'s CURRENT options? Options are already scoped to one
  // family by populateStyleOptions(), so this checks weight/style only -
  // never family. Used as a fallback when no same-role style exists.
  function findExactStyleMatch(styleKey) {
    return findOptionValue(styleDropdown.getOptions(), opt => {
      const apply = JSON.parse(opt.value);
      return apply.fontStyle && apply.fontWeight && styleKey &&
        `${apply.fontStyle}|${apply.fontWeight}` === styleKey;
    });
  }

  // Determines which populated style option matches what's ACTUALLY
  // applied right now, for reflecting the true current selection in the
  // Style dropdown. Weight/style alone isn't enough: families like
  // Viktoria Nouveau declare each named style (Big/Medium/Small) as its
  // own distinct font-family at the identical weight/style, so several
  // options can share the same weight/style key - matching only on that
  // always lands on whichever one happens to sort first, regardless of
  // which is actually applied. Requiring the option's own font-family to
  // also agree with what's actually rendered resolves the ambiguity; for
  // ordinary multi-weight families (all weights under one shared
  // font-family name), every option already shares that same family, so
  // this doesn't change behavior there.
  function findCurrentStyleMatch(styleKey, actualFamily) {
    return findOptionValue(styleDropdown.getOptions(), opt => {
      const apply = JSON.parse(opt.value);
      const styleMatches = apply.fontStyle && apply.fontWeight && styleKey &&
        `${apply.fontStyle}|${apply.fontWeight}` === styleKey;
      if (!styleMatches) return false;
      if (!apply.fontFamily || !actualFamily) return true;
      return normalizeFamily(apply.fontFamily) === actualFamily;
    });
  }

  // Called right after a family switch, once font-family has already
  // been applied but weight/style have not. For EACH run in the
  // selection independently (a selection can span multiple styles, e.g.
  // some Regular text and some Bold Italic text) implements:
  //   if a style of the same ROLE exists in the new family -> use it
  //   else if a style at the same numeric weight/style exists -> use it
  //   else -> fall back to the new family's default (first) style
  // Processing run-by-run (rather than collapsing the whole selection to
  // one matched style) is what keeps "some Regular, some Bold Italic"
  // from turning into "all Bold Italic" or "all Regular" on a family
  // switch. Always applying an explicit matched option - rather than
  // leaving the browser to guess - is what stops it from faux-bold/
  // faux-italic synthesizing a face the family doesn't actually have.
  function ensureValidStyleForFamily(familyValue) {
    // Capture each run's own current role + weight/style BEFORE
    // populateStyleOptions() below touches anything downstream.
    const runInfo = [...collectRuns(selectedSpan)].map(el => {
      const computed = getComputedStyle(el);
      const weight = computed.fontWeight;
      const style = computed.fontStyle;
      return {
        el,
        role: roleForWeightStyle(weight, style),
        styleKey: `${style}|${weight}`,
      };
    });

    populateStyleOptions(familyValue);
    const options = styleDropdown.getOptions();
    const defaultValue = options[0] ? options[0].value : "";

    runInfo.forEach(({ el, role, styleKey }) => {
      const targetValue = findRoleMatch(role) || findExactStyleMatch(styleKey) || defaultValue;
      if (targetValue) {
        applyStyleToElement(el, JSON.parse(targetValue));
      }
    });
  }

  function updateFeatureControls() {
    const target = selectedSpan || activeContainer;
    const runs = [...collectRuns(target)];
    const perRunTags = runs.map(el => parseFeatureTags(getComputedStyle(el).fontFeatureSettings));

    otFeaturesPopup.querySelectorAll("input[type=checkbox]").forEach(cb => {
      const tag = cb.dataset.tag;
      if (perRunTags.length === 0) {
        cb.checked = false;
        cb.indeterminate = false;
        return;
      }
      const onCount = perRunTags.filter(tags => tags.has(tag)).length;
      if (onCount === 0) {
        cb.checked = false;
        cb.indeterminate = false;
      } else if (onCount === perRunTags.length) {
        cb.checked = true;
        cb.indeterminate = false;
      } else {
        cb.checked = false;
        cb.indeterminate = true;
      }
    });
  }

  // Reflects which alignment button, if any, matches the CURRENT state of
  // every block the selection touches. If the touched blocks don't all
  // share the same alignment (a selection spanning paragraphs with
  // different alignments), no button is shown as active - same ambiguity
  // handling used elsewhere for mixed selections.
  function updateAlignControls() {
    const target = selectedSpan || activeContainer;
    const blocks = [...collectBlocks(target, demo)];
    const aligns = new Set(blocks.map(b => getComputedStyle(b).textAlign));
    const current = aligns.size === 1 ? aligns.values().next().value : null;
    alignButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.align === current);
    });
  }

  function updateFontControls() {
    const target = selectedSpan || activeContainer;
    const { family, actualFamily, style } = inspectFonts(target);

    const familyValue = family
      ? findOptionValue(familyDropdown.getOptions(), opt => canonicalFamily(opt.value) === family)
      : "";
    familyDropdown.value = familyValue;

    populateStyleOptions(familyValue);
    styleDropdown.value = findCurrentStyleMatch(style, actualFamily);

    rebuildFeatureCheckboxes(family);
    updateFeatureControls();
    updateAlignControls();
  }

  demo.addEventListener("mouseup", () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    if (range.collapsed || !demo.contains(range.commonAncestorContainer)) {
      selectedSpan = null;
      activeContainer = closestBlock(range.startContainer, demo);
      updateFontControls();
      return;
    }

    selectedSpan = wrapSelection(range);
    updateFontControls();
  });

  demo.addEventListener("keyup", () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed && demo.contains(range.commonAncestorContainer)) {
      selectedSpan = null;
      activeContainer = closestBlock(range.startContainer, demo);
      updateFontControls();
    }
  });

  root.addEventListener("focusin", () => {
    controls.classList.add("visible");
  });

  root.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (!root.contains(document.activeElement)) {
        controls.classList.remove("visible");
      }
    });
  });

  slider.addEventListener("input", () => {
    if (!selectedSpan) {
      selectedSpan = wrapAll(activeContainer);
    }
    flattenProperty(selectedSpan, "font-size");
    setTargetStyle(selectedSpan, "fontSize", slider.value + "px");
    updateFontControls();
  });

  slider2.addEventListener("input", () => {
    if (!selectedSpan) {
      selectedSpan = wrapAll(activeContainer);
    }
    applyEmValuePerRun(selectedSpan, "line-height", slider2.value);
    updateFontControls();
  });

  slider3.addEventListener("input", () => {
    if (!selectedSpan) {
      selectedSpan = wrapAll(activeContainer);
    }
    applyEmValuePerRun(selectedSpan, "letter-spacing", slider3.value);
    updateFontControls();
  });

  familyDropdown.onChange(() => {
    if (!selectedSpan) {
      selectedSpan = wrapAll(activeContainer);
    }
    flattenProperty(selectedSpan, "font-family");
    setTargetStyle(selectedSpan, "fontFamily", familyDropdown.value);
    ensureValidStyleForFamily(familyDropdown.value);
    updateFontControls();
  });

  styleDropdown.onChange(() => {
    if (!styleDropdown.value) return;
    if (!selectedSpan) {
      selectedSpan = wrapAll(activeContainer);
    }
    const apply = JSON.parse(styleDropdown.value);
    applyStyleEntry(selectedSpan, apply);
    updateFontControls();
  });

  otFeaturesButton.addEventListener("click", (e) => {
    e.stopPropagation();
    otFeaturesPopup.classList.toggle("visible");
  });

  document.addEventListener("click", (e) => {
    if (otFeaturesPopup.classList.contains("visible") &&
        !otFeaturesPopup.contains(e.target) &&
        e.target !== otFeaturesButton) {
      otFeaturesPopup.classList.remove("visible");
    }
  });

  alignButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = selectedSpan || activeContainer;
      collectBlocks(target, demo).forEach(block => {
        block.style.textAlign = btn.dataset.align;
      });
      updateAlignControls();
    });
  });

  resetButton.addEventListener("click", () => {
    demo.innerHTML = initialDemoHTML;
    slider.value = initialSliderValue;
    slider2.value = initialSlider2Value;
    slider3.value = initialSlider3Value;
    selectedSpan = null;
    activeContainer = demo;
    updateFontControls();
  });

  updateFontControls();

  // Font discovery happens asynchronously. Refresh this editor when the
  // discovered native style names become available.
  root.addEventListener("fontstylesready", () => {
    updateFontControls();
  });
}

// Initialise every editor immediately. Nothing external is allowed to block
// the editor/control initialisation.
document.querySelectorAll(".fe-editor").forEach(initFontEditor);

// Load the OpenType parser asynchronously, then discover the native names.
// If the parser cannot be loaded, discoverFontStyles() still falls back to
// names derived from the @font-face weight/style, so the tester remains usable.
function loadOpenTypeParser() {
  return new Promise((resolve) => {
    if (window.opentype) {
      resolve(window.opentype);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js";
    script.onload = () => resolve(window.opentype || null);
    script.onerror = () => {
      console.warn("OpenType parser could not be loaded; using CSS style fallbacks.");
      resolve(null);
    };
    document.head.appendChild(script);
  });
}

loadOpenTypeParser()
  .then(() => discoverFontStyles())
  .then(() => {
    document.querySelectorAll(".fe-editor").forEach(root => {
      root.dispatchEvent(new Event("fontstylesready"));
    });
  })
  .catch(error => {
    console.warn("Font style discovery failed; editors remain functional.", error);
  });
