
import { GoogleGenAI } from "@google/genai";
import { CalculatedProduct, CalculationSummary } from "../types";

/**
 * Analyzes pricing data using the Gemini API.
 * Selection of gemini-3-pro-preview is based on the task requiring advanced reasoning for financial data analysis.
 */
export const getFinancialInsights = async (
  products: CalculatedProduct[],
  summary: CalculationSummary
) => {
  // Use named parameter for apiKey and source it from process.env.API_KEY.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Como um especialista financeiro, analise os seguintes dados de precificação comercial:
    
    Produtos e Custos Reais:
    ${products.map(p => `- ${p.description}: Qtd ${p.quantity}, Custo Base R$${p.cost.toFixed(2)}, Valor Unitário Final (após frete e ajustes de % aplicados) R$${p.finalUnitValue.toFixed(2)}`).join('\n')}
    
    Resumo Financeiro da Nota:
    - Subtotal dos Itens: R$ ${summary.subtotalProducts.toFixed(2)}
    - Custo de Frete: R$ ${summary.freight.toFixed(2)}
    - Valor do Desconto Aplicado (via %): R$ ${summary.discount.toFixed(2)}
    - Valor do Acréscimo/Margem Aplicado (via %): R$ ${summary.markup.toFixed(2)}
    - Valor Total Geral da Operação: R$ ${summary.totalGeneral.toFixed(2)}

    Forneça uma análise estratégica (máximo 3 parágrafos) sobre:
    1. O peso do frete e dos ajustes percentuais no custo final dos produtos.
    2. Sugestão de preço de venda (markup) para garantir uma margem saudável.
    3. Alerta sobre possíveis itens com custo unitário muito elevado em relação ao base.
    Use um tom profissional, consultivo e direto em português brasileiro.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    // Correctly accessing text as a property of GenerateContentResponse.
    return response.text;
  } catch (error) {
    console.error("Erro ao obter insights:", error);
    return "Não foi possível gerar insights automáticos no momento. Verifique sua conexão.";
  }
};
