export type RuleId = string;

export interface Rule {
  id: RuleId;
  label: string;
  urlPattern: string;
  selector: string;
  enabled: boolean;
  source: "preset" | "user";
}
