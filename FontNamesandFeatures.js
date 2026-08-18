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
// OpenType feature settings
// Defines which features appear for each family.
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
// Manually authored per-family style lists - the Style menu's options,
// in order. Each entry needs a display `label` and the exact `apply`
// descriptor (fontFamily/fontStyle/fontWeight, plus fontStretch if the
// face uses one) to set when it's chosen. A style's own fontFamily only
// needs to differ from its family's key when that specific style is a
// separate @font-face family in its own right - see Viktoria Nouveau's
// Big/Medium/Small below for an example of that.
//
// EDIT THESE to match your actual font files - the weights below are
// placeholders, not verified against the real @font-face declarations.
const FAMILY_STYLES = {
  "leafy text": [
    { label: "Regular", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "400" } },
    { label: "Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "400" } },
    { label: "News", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "450" } },
    { label: "News Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "450" } },
    { label: "Medium", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "500" } },
    { label: "Medium Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "500" } },
    { label: "SemiBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "600" } },
    { label: "SemiBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "600" } },
    { label: "Bold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "700" } },
    { label: "Bold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "700" } },
    { label: "ExtraBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "800" } },
    { label: "ExtraBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "800" } },
    { label: "Black", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "900" } },
    { label: "Black Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "900" } },
    
  ],
  "leafy subhead": [
   { label: "Regular", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "400" } },
    { label: "Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "400" } },
    { label: "News", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "450" } },
    { label: "News Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "450" } },
    { label: "Medium", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "500" } },
    { label: "Medium Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "500" } },
    { label: "SemiBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "600" } },
    { label: "SemiBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "600" } },
    { label: "Bold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "700" } },
    { label: "Bold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "700" } },
    { label: "ExtraBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "800" } },
    { label: "ExtraBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "800" } },
    { label: "Black", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "900" } },
    { label: "Black Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "900" } },
  ],
  "leafy display": [
    { label: "Regular", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "400" } },
    { label: "Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "400" } },
    { label: "News", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "450" } },
    { label: "News Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "450" } },
    { label: "Medium", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "500" } },
    { label: "Medium Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "500" } },
    { label: "SemiBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "600" } },
    { label: "SemiBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "600" } },
    { label: "Bold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "700" } },
    { label: "Bold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "700" } },
    { label: "ExtraBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "800" } },
    { label: "ExtraBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "800" } },
    { label: "Black", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "900" } },
    { label: "Black Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "900" } },
  ],
  "leafy banner": [
   { label: "Regular", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "400" } },
    { label: "Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "400" } },
    { label: "News", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "450" } },
    { label: "News Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "450" } },
    { label: "Medium", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "500" } },
    { label: "Medium Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "500" } },
    { label: "SemiBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "600" } },
    { label: "SemiBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "600" } },
    { label: "Bold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "700" } },
    { label: "Bold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "700" } },
    { label: "ExtraBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "800" } },
    { label: "ExtraBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "800" } },
    { label: "Black", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "900" } },
    { label: "Black Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "900" } },
  ],
  "leafy sans": [
    
    { label: "Thin", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "100" } },
    { label: "Thin Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "100" } },
    { label: "ExtraLight", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "200" } },
    { label: "ExtraLight Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "200" } },
    { label: "Light", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "300" } },
    { label: "Light Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "300" } }
    { label: "Regular", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "400" } },
    { label: "Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "400" } },
    { label: "News", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "450" } },
    { label: "News Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "450" } },
    { label: "Medium", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "500" } },
    { label: "Medium Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "500" } },
    { label: "SemiBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "600" } },
    { label: "SemiBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "600" } },
    { label: "Bold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "700" } },
    { label: "Bold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "700" } },
    { label: "ExtraBold", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "800" } },
    { label: "ExtraBold Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "800" } },
    { label: "Black", apply: { fontFamily: '"Leafy Text"', fontStyle: "normal", fontWeight: "900" } },
    { label: "Black Italic", apply: { fontFamily: '"Leafy Text"', fontStyle: "italic", fontWeight: "900" } },
  ],
  "viktoria nouveau": [
    { label: "Big", apply: { fontFamily: '"Viktoria Nouveau Big"', fontStyle: "normal", fontWeight: "400" } },
    { label: "Medium", apply: { fontFamily: '"Viktoria Nouveau Medium"', fontStyle: "normal", fontWeight: "400" } },
    { label: "Small", apply: { fontFamily: '"Viktoria Nouveau Small"', fontStyle: "normal", fontWeight: "400" } },
  ],
};
