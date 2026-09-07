import { createInstance } from "i18next";
import { ja } from "./ja.ts";

export type MessageKey = keyof typeof ja;
type Slots<S extends string> =
  S extends `${string}{{${infer Name}}}${infer Rest}`
    ? Name | Slots<Rest>
    : never;
type Parameters<K extends MessageKey> = {
  [P in Slots<(typeof ja)[K]>]: P extends "count" ? number : string | number;
};
type Arguments<K extends MessageKey> = [Slots<(typeof ja)[K]>] extends [never]
  ? [params?: never]
  : [params: Parameters<K>];
export type MessageParams = Record<string, string | number>;
export type MessageDescriptor = {
  messageKey?: string;
  messageParams?: MessageParams;
  fieldLabel?: string;
  recordNumber?: number;
};
export type LocalizedMessage = MessageDescriptor & { message: string };
export const defaultLocale = "ja";

export function messageKey<K extends MessageKey>(key: K): K {
  return key;
}
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(ja, key);
}
export function placeholders(value: string): string[] {
  return [
    ...new Set([...value.matchAll(/{{(\w+)}}/g)].map((match) => match[1])),
  ].sort();
}
// 翻訳追加時は、存在しないキーや差し込み値の欠落・追加を拒否する。
export function validateCatalog(catalog: Record<string, string>): string[] {
  return Object.entries(catalog).flatMap(([key, value]) => {
    const base = key.replace(/_(zero|one|two|few|many|other)$/, "");
    if (!isMessageKey(base)) return [`Unknown message key: ${key}`];
    if (
      !value.trim() ||
      placeholders(value).join() !== placeholders(ja[base]).join()
    )
      return [`Invalid message parameters: ${key}`];
    return [];
  });
}

// 言語ごとに独立したインスタンス。Workersのリクエスト間で言語を変更しない。
// 現在の製品は日本語のみ。追加カタログは検証や将来の翻訳追加に使う。
export function createTranslator(
  locale = defaultLocale,
  catalog: Record<string, string> = {},
) {
  const errors = validateCatalog(catalog);
  if (errors.length) throw new Error(errors.join("\n"));
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: defaultLocale,
    resources: {
      ja: { translation: locale === "ja" ? { ...ja, ...catalog } : ja },
      ...(locale === "ja" ? {} : { [locale]: { translation: catalog } }),
    },
    initAsync: false,
    keySeparator: false,
    interpolation: { escapeValue: false, skipOnVariables: true },
    returnNull: false,
  });
  function render(key: MessageKey, params: MessageParams = {}): string {
    if (
      placeholders(ja[key]).some((name) => {
        const value = params[name];
        return name === "count"
          ? typeof value !== "number" || !Number.isFinite(value)
          : typeof value !== "string" &&
              (typeof value !== "number" || !Number.isFinite(value));
      })
    )
      return instance.t("errors.unexpected");
    const values = Object.fromEntries(
      placeholders(ja[key]).map((name) => [name, params[name]]),
    );
    return instance.t(key, values);
  }
  function t<K extends MessageKey>(key: K, ...args: Arguments<K>): string {
    return render(key, args[0]);
  }
  function message(descriptor: MessageDescriptor): string {
    let text =
      descriptor.messageKey && isMessageKey(descriptor.messageKey)
        ? render(descriptor.messageKey, descriptor.messageParams)
        : render("errors.unexpected");
    if (descriptor.fieldLabel)
      text = t("errors.fieldDetail", {
        label: descriptor.fieldLabel,
        detail: text,
      });
    if (descriptor.recordNumber !== undefined)
      text = t("errors.recordDetail", {
        number: descriptor.recordNumber,
        detail: text,
      });
    return text;
  }
  return {
    t,
    message,
    list: (values: string[]) =>
      new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(
        values,
      ),
  };
}
export const translator = createTranslator();
export const t = translator.t;
export function describe<K extends MessageKey>(
  key: K,
  ...args: Arguments<K>
): LocalizedMessage {
  return { messageKey: key, messageParams: args[0], message: t(key, ...args) };
}
export class MessageError extends Error implements MessageDescriptor {
  messageKey?: string;
  messageParams?: MessageParams;
  constructor(description: LocalizedMessage) {
    super(description.message);
    this.messageKey = description.messageKey;
    this.messageParams = description.messageParams;
  }
}

// Zodの英語文面には依存せず、独自キーまたはissueの構造から表示を決める。
export function describeValidation(issue: {
  message: string;
  code: string;
  path: PropertyKey[];
}): LocalizedMessage {
  if (isMessageKey(issue.message))
    return {
      messageKey: issue.message,
      message: translator.message({ messageKey: issue.message }),
    };
  const property = issue.path.at(-1);
  if (property === "id" || property === "initialState")
    return describe("errors.identifier");
  if (property === "name" || property === "label" || property === "title")
    return describe("errors.requiredName");
  return describe("errors.input");
}
