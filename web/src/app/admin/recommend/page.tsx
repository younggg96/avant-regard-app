"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { recommendApi, type RecommendConfig } from "@/lib/services/admin";
import {
  PageHeader,
  FormField,
  TextInput,
  Toggle,
  Button,
  LoadingState,
} from "@/components/admin/ui";


const ALL_GRADES = ["S", "A", "B", "C", "D"];

export default function RecommendPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<RecommendConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [coreRatio, setCoreRatio] = useState("70");
  const [discoveryRatio, setDiscoveryRatio] = useState("20");
  const [randomRatio, setRandomRatio] = useState("10");
  const [coldDays, setColdDays] = useState("7");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recommendApi.getConfig();
      setConfig(data);
      setCoreRatio(String(data.pool_ratios.core));
      setDiscoveryRatio(String(data.pool_ratios.discovery));
      setRandomRatio(String(data.pool_ratios.random));
      setColdDays(String(data.cold_start.days));
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleGrade = (pool: "core_pool" | "random_pool" | "cold_start", grade: string) => {
    if (!config) return;
    const grades = [...config[pool].grades];
    const idx = grades.indexOf(grade);
    if (idx >= 0) grades.splice(idx, 1);
    else grades.push(grade);
    setConfig({ ...config, [pool]: { ...config[pool], grades } });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!config) return;

    const core = Number(coreRatio) || 0;
    const discovery = Number(discoveryRatio) || 0;
    const random = Number(randomRatio) || 0;
    if (core + discovery + random !== 100) {
      alert(t("admin.ratioError"));
      return;
    }

    setSaving(true);
    try {
      await recommendApi.updateConfig({
        ...config,
        pool_ratios: { core, discovery, random },
        cold_start: { ...config.cold_start, days: Number(coldDays) || 7 },
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) return <LoadingState />;

  const ratioSum = (Number(coreRatio) || 0) + (Number(discoveryRatio) || 0) + (Number(randomRatio) || 0);

  return (
    <div>
      <PageHeader title={t("admin.recommend")} description={t("admin.recommendDesc")} />

      <div className="mx-auto max-w-xl space-y-6">
        <section className="rounded-lg border border-[var(--border)] p-5 space-y-4">
          <h3 className="font-label text-[13px] font-semibold">{t("admin.poolRatios")}</h3>
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t("admin.corePool")}>
              <TextInput value={coreRatio} onChange={(v) => { setCoreRatio(v); setDirty(true); }} type="number" />
            </FormField>
            <FormField label={t("admin.discoveryPool")}>
              <TextInput value={discoveryRatio} onChange={(v) => { setDiscoveryRatio(v); setDirty(true); }} type="number" />
            </FormField>
            <FormField label={t("admin.randomPool")}>
              <TextInput value={randomRatio} onChange={(v) => { setRandomRatio(v); setDirty(true); }} type="number" />
            </FormField>
          </div>
          <p className={`font-label text-[12px] ${ratioSum === 100 ? "text-[var(--ink)]" : "text-[color:var(--ink-muted)]"}`}>
            {t("admin.ratioTotal", { sum: ratioSum })}{ratioSum !== 100 && ` (${t("admin.ratioMustBe100")})`}
          </p>
        </section>

        <section className="rounded-lg border border-[var(--border)] p-5 space-y-4">
          <h3 className="font-label text-[13px] font-semibold">{t("admin.corePoolGrades")}</h3>
          <GradeChips grades={config.core_pool.grades} onToggle={(g) => toggleGrade("core_pool", g)} />
        </section>

        <section className="rounded-lg border border-[var(--border)] p-5 space-y-4">
          <h3 className="font-label text-[13px] font-semibold">{t("admin.discoveryPoolLabel")}</h3>
          <Toggle
            checked={config.discovery_pool.enabled}
            onChange={(v) => { setConfig({ ...config, discovery_pool: { enabled: v } }); setDirty(true); }}
            label={t("admin.enableDiscovery")}
          />
        </section>

        <section className="rounded-lg border border-[var(--border)] p-5 space-y-4">
          <h3 className="font-label text-[13px] font-semibold">{t("admin.randomPoolGrades")}</h3>
          <GradeChips grades={config.random_pool.grades} onToggle={(g) => toggleGrade("random_pool", g)} />
        </section>

        <section className="rounded-lg border border-[var(--border)] p-5 space-y-4">
          <h3 className="font-label text-[13px] font-semibold">{t("admin.coldStart")}</h3>
          <FormField label={t("admin.coldDays")}>
            <TextInput value={coldDays} onChange={(v) => { setColdDays(v); setDirty(true); }} type="number" />
          </FormField>
          <div>
            <span className="font-label text-[12px] text-[color:var(--ink-muted)]">{t("admin.grades")}</span>
            <GradeChips grades={config.cold_start.grades} onToggle={(g) => toggleGrade("cold_start", g)} />
          </div>
        </section>

        <Button onClick={handleSave} loading={saving} disabled={!dirty || ratioSum !== 100}>
          {t("admin.saveConfig")}
        </Button>
      </div>
    </div>
  );
}

function GradeChips({ grades, onToggle }: { grades: string[]; onToggle: (g: string) => void }) {
  return (
    <div className="flex gap-2">
      {ALL_GRADES.map((g) => {
        const active = grades.includes(g);
        return (
          <button
            key={g}
            onClick={() => onToggle(g)}
            className={`h-8 w-8 rounded-full font-label text-[13px] font-semibold transition-colors ${
              active
                ? "bg-[var(--ink)] text-[var(--canvas)]"
                : "border border-[var(--border)] text-[color:var(--ink-muted)]"
            }`}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}
