export const formatKM = (n: number) =>
  new Intl.NumberFormat("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n || 0)) + " KM";
