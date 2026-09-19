/** Salon adını URL/doküman-dostu bir slug'a çevirir; benzersizlik garanti etmez (çağıran taraf gerekirse rastgele son ek ekler). */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'salon'
  );
}
