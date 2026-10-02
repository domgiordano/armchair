import { Effect } from "postprocessing";

// The film's grade, after tone mapping: shadows pushed to bottle green,
// highlights to candle amber, the mids a touch desaturated, and an S-curve.
// Black stays black: nothing is lifted, so the void is never grey.
const GRADE = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 shadow = vec3(0.86, 1.04, 0.94);
  vec3 light = vec3(1.07, 0.98, 0.84);
  c *= mix(shadow, light, smoothstep(0.04, 0.55, l));
  c = mix(vec3(l), c, 0.9);
  vec3 s = c * c * (3.0 - 2.0 * c);
  c = mix(c, s, 0.35);
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`;

export class Grade extends Effect {
  constructor() {
    super("Grade", GRADE);
  }
}
