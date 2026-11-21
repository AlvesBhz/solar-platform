export const soDigitos = (s: string) => s.replace(/\D/g, '');

/** Parece CPF quando só tem dígitos e separadores (usuários têm letras). */
export const pareceCpf = (s: string) => /^[\d.\-\s]+$/.test(s.trim());

/** Máscara progressiva: 000.000.000-00. */
export function formatarCpf(s: string) {
  const d = soDigitos(s).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** Valida os dois dígitos verificadores. */
export function cpfValido(s: string) {
  const d = soDigitos(s);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += +d[i] * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
