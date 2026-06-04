export const formatKM = (n: number) =>
  new Intl.NumberFormat("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n || 0)) + " KM";

export const formatOrderNo = (n: number | null | undefined) =>
  "#" + String(n ?? 0).padStart(5, "0");

export const CATEGORY_LABEL: Record<string, string> = {
  print: "Štampa fotografija",
  album: "Foto albumi",
  gift: "Pokloni",
};
