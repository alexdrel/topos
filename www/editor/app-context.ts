import { Context, Signal } from "@alexdrel/perky";

export const mainEditorViews = ["slate", "source", "svg"] as const;
export type MainEditorView = (typeof mainEditorViews)[number];

export const MainEditorView = Context.key<MainEditorView>("slate");

export const cancelInteraction = new Signal<unknown>(null);
