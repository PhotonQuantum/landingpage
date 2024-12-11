// @ts-nocheck

import "./fonts.css";
import '@fontsource/ibm-plex-mono';

import latinNormal from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2";
import latinMedium from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2";
import latinSemibold from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2";

import {
  css as css1,
  fontFamilyFallback as fontFamilyFallback1
} from "@ibm/plex-sans-sc/fonts/complete/woff2/hinted/IBMPlexSansSC-Regular.woff2?subsets";
import {
  css as css2,
  fontFamilyFallback as fontFamilyFallback2
} from "@ibm/plex-sans-sc/fonts/complete/woff2/hinted/IBMPlexSansSC-Medium.woff2?subsets";
import {
  css as css3,
  fontFamilyFallback as fontFamilyFallback3
} from "@ibm/plex-sans-sc/fonts/complete/woff2/hinted/IBMPlexSansSC-SemiBold.woff2?subsets";
import {
  css as css4,
  fontFamilyFallback as fontFamilyFallback4
} from "@ibm/plex-sans-sc/fonts/complete/woff2/hinted/IBMPlexSansSC-Text.woff2?subsets";
import {
  css as css5,
  fontFamilyFallback as fontFamilyFallback5
} from "@ibm/plex-sans-sc/fonts/complete/woff2/hinted/IBMPlexSansSC-Thin.woff2?subsets";
import {
  css as css6,
  fontFamilyFallback as fontFamilyFallback6
} from "@ibm/plex-sans-sc/fonts/complete/woff2/hinted/IBMPlexSansSC-Bold.woff2?subsets";
import {
  css as css7,
  fontFamilyFallback as fontFamilyFallback7
} from "@ibm/plex-sans-sc/fonts/complete/woff2/hinted/IBMPlexSansSC-ExtraLight.woff2?subsets";
import {
  css as css8,
  fontFamilyFallback as fontFamilyFallback8
} from "@ibm/plex-sans-sc/fonts/complete/woff2/hinted/IBMPlexSansSC-Light.woff2?subsets";


export const fontStyle = {
  "--fonts-sans": [
    "IBM Plex Sans",
    css1.family,
    css2.family,
    css3.family,
    css4.family,
    css5.family,
    css6.family,
    css7.family,
    css8.family,
    "IBM Plex Sans fallback",
    fontFamilyFallback1,
    fontFamilyFallback2,
    fontFamilyFallback3,
    fontFamilyFallback4,
    fontFamilyFallback5,
    fontFamilyFallback6,
    fontFamilyFallback7,
    fontFamilyFallback8
  ].join(", "),
  "--fonts-mono": "IBM Plex Mono, monospace",
};

export const preloadFonts = [
  latinNormal,
  latinMedium,
  latinSemibold,
]