import type { Annotation } from "../topos.ts";
import { EIDOS_SCOPES, EIDOS_VALUES, EidosAxis, EidosMap, EidosScope, isEidosPropertyKey, VALUE_TO_AXIS } from "../eidos.ts";

export function setEidos(eidos: EidosMap, value: string, scope?: EidosScope): void {
  const axis = VALUE_TO_AXIS.get(value);
  if (axis) {
    const target = scope ? (eidos[scope] ??= {}) : eidos;
    Object.assign(target, { [axis]: value });
  }
}

export function mergeEidos(target: EidosMap | undefined, source: EidosMap | undefined): EidosMap | undefined {
  if (!source) return target;
  const merged = target ?? {};
  for (const [key, value] of Object.entries(source)) {
    if (EIDOS_SCOPES.has(key as EidosScope)) {
      const scope = key as EidosScope;
      Object.assign(merged[scope] ??= {}, value);
    } else {
      Object.assign(merged, { [key]: value });
    }
  }
  return merged;
}

export function* activeEidosValues(eidos?: EidosMap): Generator<{
  axis: EidosAxis;
  value: string;
  scope?: EidosScope;
  isDefault: boolean;
}> {
  if (!eidos) return;
  for (const [key, value] of Object.entries(eidos)) {
    if (typeof value === "string") {
      yield { axis: key as EidosAxis, value, isDefault: value === EIDOS_VALUES[key as EidosAxis]?.[0] };
    } else if (typeof value === "object" && value !== null) {
      for (const [subKey, nestedValue] of Object.entries(value)) {
        if (typeof nestedValue === "string") {
          yield {
            axis: subKey as EidosAxis,
            value: nestedValue,
            scope: key as EidosScope,
            isDefault: nestedValue === EIDOS_VALUES[subKey as EidosAxis]?.[0],
          };
        }
      }
    }
  }
}

export function applyDotToken(target: Annotation, value: string): void {
  if (VALUE_TO_AXIS.has(value)) {
    return setEidos(target.eidos ??= {}, value);
  }

  const dashIdx = value.indexOf("-");
  const scope = value.slice(0, dashIdx);
  const val = value.slice(dashIdx + 1);
  if (dashIdx !== -1 && EIDOS_SCOPES.has(scope as EidosScope) && VALUE_TO_AXIS.has(val)) {
    return setEidos(target.eidos ??= {}, val, scope as EidosScope);
  }

  (target.classes ??= []).includes(value) || target.classes.push(value);
}

export function applyBareToken(target: Annotation, token: string): void {
  if (VALUE_TO_AXIS.has(token)) {
    setEidos(target.eidos ??= {}, token);
  } else {
    (target.classes ??= []).includes(token) || target.classes.push(token);
  }
}

export function applyAssignmentToken(target: Annotation, key: string, values: string[]): void {
  if (EIDOS_SCOPES.has(key as EidosScope)) {
    for (const value of values) setEidos(target.eidos ??= {}, value, key as EidosScope);
  } else if (isEidosPropertyKey(key)) {
    const normalized = values.map((value) => value.trim());
    if (normalized.some(Boolean)) (target.properties ??= {})[key] = normalized.join(",");
  }
}

export function setAnnotation(target: Annotation, cluster: string): void {
  for (const part of cluster.split(/(?=[#@.])/)) {
    const sigil = part[0], value = part.slice(1);
    if (!value) continue;
    if (sigil === "#") target.id = value;
    else if (sigil === ".") applyDotToken(target, value);
    else if (sigil === "@") target.semanticType = value;
  }
}
