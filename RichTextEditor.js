// Shared helpers
function normalizeFamily(value) {
  return value.replace(/^["']|["']$/g, "").trim().toLowerCase();
}
// Reverse lookup: normalized applied font-family -> the FAMILY_STYLES
// key it belongs to. Built once from FAMILY_STYLES so a style whose own
// fontFamily differs from its family's key (an optical-size variant
// declared under its own font-family name, e.g. Viktoria Nouveau's
// Big/Medium/Small) is still recognized as belonging to that family.
const FAMILY_BY_APPLIED_FONT_FAMILY = new Map();
Object.entries(FAMILY_STYLES || {}).forEach(([key, styles]) => {
  FAMILY_BY_APPLIED_FONT_FAMILY.set(key, key);
  (styles || []).forEach(({ apply }) => {
    if (apply && apply.fontFamily) {
      FAMILY_BY_APPLIED_FONT_FAMILY.set(normalizeFamily(apply.fontFamily), key);
    }
  });
});
function canonicalFamily(value) {
  const family = normalizeFamily(value);
  return FAMILY_BY_APPLIED_FONT_FAMILY.get(family) || family;
}
function isSelectionGroup(target) {
  return !!(target && target.__feSelectionGroup);
}
function targetElements(target) {
  return isSelectionGroup(target) ? target.elements : [target];
}
function closestBlock(node, demo) {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
// Paragraphs define block boundaries for selections.
  const paragraph = el ? el.closest("p") : null;
  if (paragraph && demo.contains(paragraph)) return paragraph;
  const div = el ? el.closest("div") : null;
  return (div && demo.contains(div)) ? div : demo;
}
// Finds the nearest ancestor tagged [data-sample-group] - the element
// whose content the Sample dropdown swaps out entirely when an option
// is chosen.
function closestSampleGroup(node, demo) {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  const group = el ? el.closest("[data-sample-group]") : null;
  return (group && demo.contains(group)) ? group : null;
}
// The single [data-sample-group] element every non-empty text node in
// `target` belongs to, or null if that set is empty, mixed, or includes
// content outside any group - an ambiguous or groupless selection gets
// no sample swap option.
function singleSampleGroupForTarget(target, demo) {
  const groups = new Set();
  let touchedAny = false;
  targetElements(target).forEach(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      touchedAny = true;
      groups.add(closestSampleGroup(node, demo));
    }
  });
  if (!touchedAny || groups.size !== 1) return null;
  return [...groups][0];
}
// Resolves logical alignment to a physical direction.
function resolvePhysicalAlign(align, direction) {
  if (align === "start") return direction === "rtl" ? "right" : "left";
  if (align === "end") return direction === "rtl" ? "left" : "right";
  return align;
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
// Handle targets with no text nodes.
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
  if (block.contains(sourceRange.startContainer)) {
    result.setStart(sourceRange.startContainer, sourceRange.startOffset);
  } else {
    result.setStart(blockRange.startContainer, blockRange.startOffset);
  }
  if (block.contains(sourceRange.endContainer)) {
    result.setEnd(sourceRange.endContainer, sourceRange.endOffset);
  } else {
    result.setEnd(blockRange.endContainer, blockRange.endOffset);
  }
  return result;
}
// Walks demo's text nodes in document order, returning the distinct
// blocks (per closestBlock - the nearest <p>, else nearest <div>, else
// demo itself) that `range` actually touches. Driven by text nodes
// rather than a fixed tag query so it catches ANY block boundary the
// range crosses, not just <p>.
function collectRangeBlocks(range, demo) {
  const blocks = [];
  const seen = new Set();
  const walker = document.createTreeWalker(demo, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent.trim()) continue;
    if (!rangeIntersectsNode(range, node)) continue;
    const block = closestBlock(node, demo);
    if (!seen.has(block)) {
      seen.add(block);
      blocks.push(block);
    }
  }
  return blocks;
}
function wrapSelection(range) {
// Use one span per block for selections crossing block boundaries.
  const demo = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer.closest(".fe-demo")
    : range.commonAncestorContainer.parentElement?.closest(".fe-demo");
  const blocks = demo ? collectRangeBlocks(range, demo) : [];
  if (blocks.length <= 1) {
    return wrapContentsInSpan(range);
  }
// Process from the end so ranges stay valid.
  const spans = [];
  [...blocks].reverse().forEach(block => {
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
// A weight/style-derived label used only to match "Bold" to "Bold" when
// switching families (see findRoleMatch below) - never shown directly.
function cssStyleFallbackLabel(weightStyle) {
  const numeric = parseFloat(weightStyle.weight);
  const weightNames = {
    100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
    450: "News", 500: "Medium", 600: "SemiBold", 700: "Bold",
    800: "ExtraBold", 900: "Black",
  };
  let label = weightNames[numeric] || weightStyle.weight || "Regular";
  if (weightStyle.style === "italic" && label !== "Italic") label += " Italic";
  return label;
}
function roleForWeightStyle(weight, style) {
  return cssStyleFallbackLabel({ weight, style }).toLowerCase();
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
// Finds the first non-empty text node.
function firstTextNodeIn(elements) {
  for (const element of elements) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim()) return node;
    }
  }
  return null;
}
// Finds the element immediately after a collapsed cursor.
function characterElementAfterPosition(container, offset, demo) {
// Fast path for text remaining in the current node.
  if (container.nodeType === Node.TEXT_NODE && offset < container.textContent.length) {
    return container.parentElement;
  }
// Otherwise search text nodes in document order.
  let refPoint;
  try {
    refPoint = document.createRange();
    refPoint.setStart(container, offset);
  } catch {
    return container.nodeType === Node.TEXT_NODE ? container.parentElement : null;
  }
  const walker = document.createTreeWalker(demo, NodeFilter.SHOW_TEXT);
  let node;
  let lastSeen = null;
  while ((node = walker.nextNode())) {
    if (!node.textContent.trim()) continue;
    const nodeStart = document.createRange();
    nodeStart.setStart(node, 0);
    if (refPoint.compareBoundaryPoints(Range.START_TO_START, nodeStart) <= 0) {
      return node.parentElement;
    }
    lastSeen = node;
  }
// Use the last character when the cursor is at the end.
  return lastSeen ? lastSeen.parentElement : null;
}
// Apply em values per run so each uses its own font size.
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
// Custom dropdown with consistent font previews.
function createFontDropdown(wrapperClass) {
  const wrapper = document.createElement("div");
  wrapper.className = "fe-dropdown " + wrapperClass;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fe-dropdown-button";
  const label = document.createElement("span");
  label.className = "fe-dropdown-label";
  const arrow = document.createElement("span");
  arrow.className = "fe-dropdown-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.innerHTML = '<svg viewBox="0 0 12 8" width="12" height="8" fill="currentColor"><path d="M1 1l5 5 5-5"/></svg>';
  button.appendChild(label);
  button.appendChild(arrow);
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
  function setOpen(open) {
    popup.classList.toggle("visible", open);
    button.classList.toggle("open", open);
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
        setOpen(false);
// Keeps focus inside root - render() just destroyed this row, which
// otherwise strands focus on <body> and breaks click-outside-to-close.
        button.focus();
        listeners.forEach(fn => fn());
      });
      popup.appendChild(row);
    });
    const current = options.find(o => o.value === value);
    label.textContent = current ? current.label : "";
    applyPreview(label, current ? current.previewStyle : null);
  }
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!popup.classList.contains("visible"));
  });
  document.addEventListener("click", (e) => {
    if (popup.classList.contains("visible") && !popup.contains(e.target) && e.target !== button) {
      setOpen(false);
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
// Font styles
// Built directly from FAMILY_STYLES (see head) - no runtime discovery.
const STYLE_CATALOG = {};
Object.entries(FAMILY_STYLES || {}).forEach(([key, styles]) => {
  STYLE_CATALOG[key] = (styles || []).map(({ label, apply }) => ({
    label,
    role: roleForWeightStyle(apply.fontWeight || "400", apply.fontStyle || "normal"),
    apply,
  }));
});
// Warms the browser's font cache for every configured style ahead of
// time, so Style menu previews don't visibly pop in the first time the
// menu is opened.
function preloadStyleFace(apply) {
  if (!("fonts" in document) || !apply || !apply.fontFamily) return;
  const style = apply.fontStyle === "italic" ? "italic " : "";
  document.fonts.load(`${style}${apply.fontWeight || "400"} 16px ${apply.fontFamily}`).catch(() => {});
}
Object.values(FAMILY_STYLES || {}).forEach(styles => {
  (styles || []).forEach(({ apply }) => preloadStyleFace(apply));
});
// Use default features when no family-specific list exists.
const DEFAULT_LABEL_BY_TAG = Object.fromEntries(OT_FEATURES.map(f => [f.tag, f.label]));
// Normalises a feature entry to a tag and label.
function normaliseFeatureEntry(entry) {
  if (typeof entry === "string") {
    return { tag: entry, label: DEFAULT_LABEL_BY_TAG[entry] || entry };
  }
  return { tag: entry.tag, label: entry.label || DEFAULT_LABEL_BY_TAG[entry.tag] || entry.tag };
}
function featuresForFamily(family) {
  const entries = family && FAMILY_FEATURES[family]
    ? FAMILY_FEATURES[family]
    : OT_FEATURES.map(f => f.tag);
  return entries.map(normaliseFeatureEntry);
}
// Build one editor's controls.
function buildControls(root) {
  const controlsOuter = document.createElement("div");
  controlsOuter.className = "fe-controls-outer";
  const controls = document.createElement("div");
  controls.className = "fe-controls";
// Keep background clicks inside the controls panel.
  controls.tabIndex = -1;
// Row 1: size, leading and tracking.
  const sliderRow = document.createElement("div");
  sliderRow.className = "fe-control-row fe-slider-row";
  const sizeLabel = document.createElement("label");
  sizeLabel.className = "fe-slider-box";
  sizeLabel.appendChild(document.createTextNode("Size"));
  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "fe-slider";
  slider.min = "10";
  slider.max = "500";
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
  slider3.min = "-.075";
  slider3.max = ".5";
  slider3.step = ".005";
  slider3.value = "0";
  trackingLabel.appendChild(slider3);
  sliderRow.appendChild(trackingLabel);
  controls.appendChild(sliderRow);
// Row 2: font, style, alignment, uppercase, features and reset.
  const menuRow = document.createElement("div");
  menuRow.className = "fe-control-row";
  const slidersToggle = document.createElement("button");
  slidersToggle.type = "button";
  slidersToggle.className = "fe-sliders-toggle";
  slidersToggle.title = "Sliders";
  slidersToggle.setAttribute("aria-expanded", "false");
  slidersToggle.innerHTML = '<svg viewBox="0 0 20 14" width="20" height="14" fill="currentColor">' +
    '<rect x="1" y="3" width="18" height="2"/><rect x="1" y="9" width="18" height="2"/>' +
    '<circle cx="6" cy="4" r="3"/><circle cx="14" cy="10" r="3"/>' +
    '</svg>';
  menuRow.appendChild(slidersToggle);
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
  const sampleDropdown = createFontDropdown("fe-sample-dropdown");
  const sampleField = document.createElement("div");
  sampleField.className = "fe-dropdown-field";
  sampleField.appendChild(document.createTextNode("Sample"));
  sampleField.appendChild(sampleDropdown.element);
  menuRow.appendChild(sampleField);
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
  const uppercaseButton = document.createElement("button");
  uppercaseButton.type = "button";
  uppercaseButton.className = "fe-uppercase-button";
  uppercaseButton.title = "Uppercase";
  uppercaseButton.textContent = "AA";
  menuRow.appendChild(uppercaseButton);
  const otWrapper = document.createElement("div");
  otWrapper.className = "fe-ot-wrapper";
  const otFeaturesButton = document.createElement("button");
  otFeaturesButton.type = "button";
  otFeaturesButton.className = "fe-ot-button";
  const otFeaturesLabel = document.createElement("span");
  otFeaturesLabel.textContent = "OpenType Features";
  const otFeaturesArrow = document.createElement("span");
  otFeaturesArrow.className = "fe-dropdown-arrow";
  otFeaturesArrow.setAttribute("aria-hidden", "true");
  otFeaturesArrow.innerHTML = '<svg viewBox="0 0 12 8" width="12" height="8" fill="currentColor"><path d="M1 1l5 5 5-5"/></svg>';
  otFeaturesButton.appendChild(otFeaturesLabel);
  otFeaturesButton.appendChild(otFeaturesArrow);
  const otFeaturesPopup = document.createElement("div");
  otFeaturesPopup.className = "fe-ot-popup";
  otWrapper.appendChild(otFeaturesButton);
  otWrapper.appendChild(otFeaturesPopup);
  menuRow.appendChild(otWrapper);
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "fe-reset-button";
  resetButton.title = "Reset";
  resetButton.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>' +
    '</svg>';
  menuRow.appendChild(resetButton);
  controls.appendChild(menuRow);
  controlsOuter.appendChild(controls);
  root.appendChild(controlsOuter);
  return {
    controls, controlsOuter, slider, slider2, slider3, familyDropdown, styleDropdown,
    resetButton, otFeaturesButton, otFeaturesPopup, alignButtons, uppercaseButton,
    slidersToggle, sampleDropdown, sampleField,
  };
}
// Per-editor setup.
function initFontEditor(root) {
  const demo = root.querySelector(".fe-demo");
  demo.spellcheck = false;
  const {
    controls, controlsOuter, slider, slider2, slider3, familyDropdown, styleDropdown,
    resetButton, otFeaturesButton, otFeaturesPopup, alignButtons, uppercaseButton,
    slidersToggle, sampleDropdown, sampleField,
  } = buildControls(root);
  const initialDemoHTML = demo.innerHTML;
  const initialSliderValue = slider.value;
  const initialSlider2Value = slider2.value;
  const initialSlider3Value = slider3.value;
  let selectedSpan = null;
  let activeContainer = demo;
// Reference element after a collapsed cursor.
  let caretReferenceElement = null;
// The [data-sample-group] element the Sample dropdown's current
// options apply to - set by updateSampleControl, read by its onChange.
  let currentSampleGroupEl = null;
// Rebuild feature controls only when the family changes.
  let currentFeatureFamily = undefined;
// Rebuilds the OpenType feature controls.
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
// Rebuilds the style dropdown for the selected family.
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
// Finds a style with the same weight/style role.
  function findRoleMatch(role) {
    if (!role) return "";
    return findOptionValue(styleDropdown.getOptions(), opt => opt.role === role);
  }
// Finds an exact weight/style match as a fallback.
  function findExactStyleMatch(styleKey) {
    return findOptionValue(styleDropdown.getOptions(), opt => {
      const apply = JSON.parse(opt.value);
      return apply.fontStyle && apply.fontWeight && styleKey &&
        `${apply.fontStyle}|${apply.fontWeight}` === styleKey;
    });
  }
// Matches the currently applied style, including its family.
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
// Preserve each run's weight/style when changing family.
  function ensureValidStyleForFamily(familyValue) {
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
// Highlights alignment only when all blocks agree.
  function updateAlignControls() {
    const target = selectedSpan || activeContainer;
    const blocks = [...collectBlocks(target, demo)];
    const aligns = new Set(blocks.map(b => {
      const computed = getComputedStyle(b);
      return resolvePhysicalAlign(computed.textAlign, computed.direction);
    }));
    const current = aligns.size === 1 ? aligns.values().next().value : null;
    alignButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.align === current);
    });
  }
// Highlights uppercase only when all runs agree.
  function updateUppercaseControl() {
    const target = selectedSpan || activeContainer;
    const runs = [...collectRuns(target)];
    const isUppercase = runs.length > 0 &&
      runs.every(el => getComputedStyle(el).textTransform === "uppercase");
    uppercaseButton.classList.toggle("active", isUppercase);
  }
// Reference element used by the controls.
  function referenceElementForControls() {
    if (selectedSpan) {
      const node = firstTextNodeIn(targetElements(selectedSpan));
      return node ? node.parentElement : null;
    }
    return caretReferenceElement;
  }
// Converts computed leading/tracking back to em values.
  function updateSliderControls() {
    const el = referenceElementForControls();
    if (!el) return;
    const computed = getComputedStyle(el);
    const fontSizePx = parseFloat(computed.fontSize);
    if (isFinite(fontSizePx)) {
      slider.value = fontSizePx;
    }
    if (isFinite(fontSizePx) && fontSizePx > 0) {
      const lineHeightPx = parseFloat(computed.lineHeight);
      if (isFinite(lineHeightPx)) {
        slider2.value = (lineHeightPx / fontSizePx).toFixed(3);
      }
      const letterSpacingPx = parseFloat(computed.letterSpacing);
      slider3.value = isFinite(letterSpacingPx) ? (letterSpacingPx / fontSizePx).toFixed(3) : 0;
    }
  }
// Gets the family/style from the same reference element.
  function inspectReferenceFont() {
    const el = referenceElementForControls();
    if (!el) return { family: null, actualFamily: null, style: null };
    const computed = getComputedStyle(el);
    const actualFamily = computed.fontFamily.replace(/["']/g, "").trim().toLowerCase();
    return {
      family: canonicalFamily(actualFamily),
      actualFamily,
      style: `${computed.fontStyle}|${computed.fontWeight}`,
    };
  }
// Populates the Sample dropdown from whichever single [data-sample-group]
// the current selection is entirely within, reading its options from the
// matching <template data-sample-texts-for="...">. Each option's value
// is that template entry's innerHTML - the exact markup that replaces
// the group's entire current content when chosen. Hidden whenever that
// group is ambiguous (a selection spanning more than one, or none) or
// has no template of its own to offer.
  function updateSampleControl() {
    const groupEl = selectedSpan
      ? singleSampleGroupForTarget(selectedSpan, demo)
      : closestSampleGroup(activeContainer, demo);
    currentSampleGroupEl = groupEl;
    const groupName = groupEl ? groupEl.dataset.sampleGroup : null;
    const template = groupName
      ? root.querySelector(`template[data-sample-texts-for="${CSS.escape(groupName)}"]`)
      : null;
    const options = template
      ? [...template.content.children].map(optionEl => ({
          value: optionEl.innerHTML,
          label: optionEl.dataset.label || "Untitled",
        }))
      : [];
    sampleField.style.display = options.length ? "" : "none";
    sampleDropdown.setOptions(options);
    if (!options.length) {
      sampleDropdown.value = "";
      return;
    }
    const currentHTML = groupEl.innerHTML.trim();
    const match = options.find(opt => opt.value.trim() === currentHTML);
    sampleDropdown.value = match ? match.value : "";
  }
  function updateFontControls() {
    const { family, actualFamily, style } = inspectReferenceFont();
    const familyValue = family
      ? findOptionValue(familyDropdown.getOptions(), opt => canonicalFamily(opt.value) === family)
      : "";
    familyDropdown.value = familyValue;
    populateStyleOptions(familyValue);
    styleDropdown.value = findCurrentStyleMatch(style, actualFamily);
    rebuildFeatureCheckboxes(family);
    updateFeatureControls();
    updateAlignControls();
    updateUppercaseControl();
    updateSliderControls();
    updateSampleControl();
  }
// Treat a multi-paragraph group as one target.
  function closestParagraphGroup(node, demo) {
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    let current = el;
    while (current && current !== demo) {
      const paragraphs = current.querySelectorAll?.(":scope > p");
      if (paragraphs && paragraphs.length > 1) return current;
      current = current.parentElement;
    }
    return closestBlock(node, demo);
  }
  demo.addEventListener("mouseup", () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed || !demo.contains(range.commonAncestorContainer)) {
      selectedSpan = null;
      activeContainer = closestParagraphGroup(range.startContainer, demo);
      caretReferenceElement = demo.contains(range.startContainer)
        ? characterElementAfterPosition(range.startContainer, range.startOffset, demo)
        : null;
      updateFontControls();
      return;
    }
    selectedSpan = wrapSelection(range);
    caretReferenceElement = null;
    updateFontControls();
  });
  demo.addEventListener("keyup", () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed && demo.contains(range.commonAncestorContainer)) {
      selectedSpan = null;
      activeContainer = closestParagraphGroup(range.startContainer, demo);
      caretReferenceElement = characterElementAfterPosition(range.startContainer, range.startOffset, demo);
      updateFontControls();
    }
  });
  root.addEventListener("focusin", () => {
    controlsOuter.classList.add("visible");
  });
  root.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (!root.contains(document.activeElement)) {
        controlsOuter.classList.remove("visible");
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
  sampleDropdown.onChange(() => {
    if (!currentSampleGroupEl || !sampleDropdown.value) return;
    currentSampleGroupEl.innerHTML = sampleDropdown.value;
// The old selection lived in nodes that no longer exist - start fresh
// with the whole swapped-in group as the active target.
    selectedSpan = null;
    activeContainer = currentSampleGroupEl;
    caretReferenceElement = null;
    updateFontControls();
  });
  otFeaturesButton.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !otFeaturesPopup.classList.contains("visible");
    otFeaturesPopup.classList.toggle("visible", open);
    otFeaturesButton.classList.toggle("open", open);
  });
  document.addEventListener("click", (e) => {
    if (otFeaturesPopup.classList.contains("visible") &&
        !otFeaturesPopup.contains(e.target) &&
        e.target !== otFeaturesButton) {
      otFeaturesPopup.classList.remove("visible");
      otFeaturesButton.classList.remove("open");
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
  uppercaseButton.addEventListener("click", () => {
    if (!selectedSpan) {
      selectedSpan = wrapAll(activeContainer);
    }
    const turnOn = !uppercaseButton.classList.contains("active");
    flattenProperty(selectedSpan, "text-transform");
    setTargetStyle(selectedSpan, "textTransform", turnOn ? "uppercase" : "none");
    toggleFeatureTag(selectedSpan, "case", turnOn);
    updateFontControls();
  });
  slidersToggle.addEventListener("click", () => {
    const open = !controls.classList.contains("sliders-open");
    controls.classList.toggle("sliders-open", open);
    slidersToggle.classList.toggle("active", open);
    slidersToggle.setAttribute("aria-expanded", String(open));
  });
  resetButton.addEventListener("click", () => {
    demo.innerHTML = initialDemoHTML;
    slider.value = initialSliderValue;
    slider2.value = initialSlider2Value;
    slider3.value = initialSlider3Value;
    selectedSpan = null;
    activeContainer = demo;
    caretReferenceElement = null;
    updateFontControls();
// Focus leaving the root closes the controls.
    resetButton.blur();
  });
  updateFontControls();
}
// Initialise all editors. STYLE_CATALOG above is already fully built by
// this point (synchronously, from FAMILY_STYLES) - no waiting needed.
document.querySelectorAll(".fe-editor").forEach(initFontEditor);
