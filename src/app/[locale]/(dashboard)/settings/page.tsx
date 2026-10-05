import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsGeneral } from "@/components/settings/SettingsGeneral";
import { SettingsCurrency } from "@/components/settings/SettingsCurrency";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { normalizeCurrency } from "@/lib/currency";
import { updateClubCurrencyAction } from "./actions";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const org = await requireOrganization();
  const supabase = await createServerClient();

  const [canManage, orgRow] = await Promise.all([
    hasPermission("club_settings.manage"),
    supabase
      .from("organizations")
      .select("currency")
      .eq("id", org.organizationId)
      .maybeSingle()
      .then((result) => result.data),
  ]);
  const clubCurrency = normalizeCurrency(orgRow?.currency);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="max-w-2xl space-y-6">
        <SettingsGeneral
          generalTitle={t("general")}
          languageTitle={t("language")}
          languageDescription={t("languageDescription")}
          themeTitle={t("theme")}
          themeDescription={t("themeDescription")}
          srLabel={t("langSr")}
          enLabel={t("langEn")}
          lightLabel={t("themeLight")}
          darkLabel={t("themeDark")}
        />
        <SettingsCurrency
          action={updateClubCurrencyAction}
          current={clubCurrency}
          canManage={canManage}
          title={t("currency")}
          description={t("currencyDescription")}
          rsdLabel={t("currencyRsd")}
          eurLabel={t("currencyEur")}
          saveLabel={t("currencySave")}
          savingLabel={tc("saving")}
        />
      </div>
    </div>
  );
}
