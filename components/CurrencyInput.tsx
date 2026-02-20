import React from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, className, placeholder }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove tudo que não é dígito
    const rawValue = e.target.value.replace(/\D/g, '');
    
    // Converte para número (divide por 100 para considerar os centavos)
    const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
    
    onChange(numericValue);
  };

  // Formata para exibição (pt-BR)
  // Se o valor for 0, mostra vazio para manter consistência com o placeholder, 
  // ou podemos mostrar '0,00'. O código original usava '' para 0.
  // Vamos mostrar formatado se tiver valor, mas se for 0 e o usuário estiver apagando,
  // o comportamento de máscara geralmente mostra 0,00 ou vazio.
  // Para inputs de moeda, ver 0,00 é comum. Mas o código original usava || ''
  // Vamos tentar manter vazio se 0 para respeitar o placeholder, mas máscaras de moeda
  // geralmente funcionam melhor sempre mostrando os números.
  // Teste: Se eu digitar 1 -> 0,01. Se eu apagar -> 0 -> vazio.
  const displayValue = value 
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
    : '';

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default CurrencyInput;
