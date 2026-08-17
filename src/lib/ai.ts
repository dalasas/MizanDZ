import { getDb } from './db';
import type { Database } from 'sql.js';
import { GoogleGenAI } from '@google/genai';

export interface AIToolResult {
  toolName: string;
  data: any;
  textResponse: string;
}

export async function processLocalAIQuery(userQuery: string, userId: string = 'usr-admin'): Promise<AIToolResult> {
  const db = await getDb();
  const lowerQuery = userQuery.trim().toLowerCase();

  // Tool 1: Get Profit Calculation ("شحال ربحت اليوم؟", "كم أرباح اليوم؟", "ربح", "profit")
  if (lowerQuery.includes('ربح') || lowerQuery.includes('ربحت') || lowerQuery.includes('أرباح') || lowerQuery.includes('فائدة')) {
    let period = 'today';
    if (lowerQuery.includes('شهر') || lowerQuery.includes('هذا الشهر')) period = 'month';
    if (lowerQuery.includes('أسبوع') || lowerQuery.includes('هذا الأسبوع')) period = 'week';

    const profitData = calculateSystemProfit(db, period);
    const formattedText = `📊 **تقرير الأرباح الحقيقي بالنظام (${profitData.periodLabel}):**\n\n` +
      `• **إجمالي المبيعات (Revenue):** ${profitData.revenue.toLocaleString('ar-DZ')} دج\n` +
      `• **تكلفة البضاعة المباعة (COGS):** ${profitData.cogs.toLocaleString('ar-DZ')} دج\n` +
      `• **مجمل الربح (Gross Profit):** ${profitData.grossProfit.toLocaleString('ar-DZ')} دج\n` +
      `• **إجمالي المصاريف (Expenses):** ${profitData.expenses.toLocaleString('ar-DZ')} دج\n` +
      `• 💰 **صافي الربح الحقيقي (Net Profit):** **${profitData.netProfit.toLocaleString('ar-DZ')} دج**\n\n` +
      `*(تنبيه: الأرباح محسوبة بدقة متناهية عبر النظام وقاعدة بيانات SQLite).*`;

    return {
      toolName: 'GetProfit',
      data: profitData,
      textResponse: formattedText
    };
  }

  // Tool 2: Customer Debt / Balance ("محمد شحال عليه؟", "دين محمد", "شحال تسال لـ", "رصيد الزبون")
  if (lowerQuery.includes('عليه') || lowerQuery.includes('تسال') || lowerQuery.includes('دين') || lowerQuery.includes('ديون') || lowerQuery.includes('زبون')) {
    // Extract customer name if mentioned
    const customers = getQueryResult(db, `SELECT Id, Name, Phone, Balance, DebtLimit FROM Customers WHERE IsActive = 1 OR Balance > 0`);
    
    // Search for match in query
    let matchedCustomer = null;
    for (const cust of customers) {
      const namePart = cust.Name.split(' ')[0].toLowerCase();
      if (lowerQuery.includes(namePart) && namePart.length > 2) {
        matchedCustomer = cust;
        break;
      }
    }

    if (matchedCustomer) {
      const statusText = matchedCustomer.Balance > 0 
        ? `عليه دين بمبلغ **${matchedCustomer.Balance.toLocaleString('ar-DZ')} دج** (حد الدين: ${matchedCustomer.DebtLimit.toLocaleString('ar-DZ')} دج).`
        : `ليس عليه أي دين حالياً (الرصيد: 0 دج).`;

      return {
        toolName: 'GetCustomerBalance',
        data: matchedCustomer,
        textResponse: `👤 **معلومات الزبون (${matchedCustomer.Name}):**\n\n${statusText}\n📱 الهاتف: ${matchedCustomer.Phone || 'غير محدد'}`
      };
    } else {
      // List all debtors
      const debtors = customers.filter(c => c.Balance > 0);
      let text = `📋 **قائمة ديون الزبائن المسجلة في النظام (${debtors.length}):**\n\n`;
      debtors.forEach(d => {
        text += `• **${d.Name}**: ${d.Balance.toLocaleString('ar-DZ')} دج\n`;
      });
      const totalDebt = debtors.reduce((sum, d) => sum + d.Balance, 0);
      text += `\n🔴 **إجمالي ديون الزبائن المستحقة:** **${totalDebt.toLocaleString('ar-DZ')} دج**`;

      return {
        toolName: 'GetCustomerBalance',
        data: debtors,
        textResponse: text
      };
    }
  }

  // Tool 3: Sales Summary ("شحال بعت اليوم؟", "المبيعات اليوم", "sales today")
  if (lowerQuery.includes('بعت') || lowerQuery.includes('مبيعات') || lowerQuery.includes('فواتير اليوم')) {
    const todayStr = new Date().toISOString().substring(0, 10);
    const salesRes = getQueryResult(db, `SELECT COUNT(*) as Count, SUM(GrandTotal) as TotalRevenue, SUM(PaidAmount) as TotalPaid, SUM(RemainingAmount) as TotalRemaining FROM Sales WHERE strftime('%Y-%m-%d', CreatedAt) = ?`, [todayStr]);
    
    const count = salesRes[0]?.Count || 0;
    const rev = salesRes[0]?.TotalRevenue || 0;
    const paid = salesRes[0]?.TotalPaid || 0;
    const remaining = salesRes[0]?.TotalRemaining || 0;

    return {
      toolName: 'GetSalesSummary',
      data: { count, rev, paid, remaining },
      textResponse: `🛒 **ملخص مبيعات اليوم (${todayStr}):**\n\n` +
        `• **عدد الفواتير المنفذة:** ${count} فاتورة\n` +
        `• **إجمالي قيمة المبيعات:** **${rev.toLocaleString('ar-DZ')} دج**\n` +
        `• **المبالغ المحصلة نقداً:** ${paid.toLocaleString('ar-DZ')} دج\n` +
        `• **المبالغ المتبقية كديون:** ${remaining.toLocaleString('ar-DZ')} دج`
    };
  }

  // Tool 4: Product Search & Stock Inspection ("واش عندي من زيت؟", "كاين حليب ناقص؟", "البحث عن منتج")
  if (lowerQuery.includes('واش عندي') || lowerQuery.includes('كاين') || lowerQuery.includes('شحال عندي') || lowerQuery.includes('زيت') || lowerQuery.includes('حليب') || lowerQuery.includes('سكر') || lowerQuery.includes('قهوة') || lowerQuery.includes('منتج') || lowerQuery.includes('مخزون')) {
    // Extract potential product search keyword
    let keyword = '';
    const keywords = ['زيت', 'حليب', 'سكر', 'قهوة', 'صابون', 'طماطم', 'عصير', 'أرز', 'فرينة', 'جبن', 'معكرونة'];
    for (const kw of keywords) {
      if (lowerQuery.includes(kw)) {
        keyword = kw;
        break;
      }
    }

    let sql = `SELECT p.*, c.Name as CategoryName FROM Products p LEFT JOIN Categories c ON p.CategoryId = c.Id WHERE p.IsDeleted = 0`;
    let params: any[] = [];

    if (keyword) {
      sql += ` AND (p.Name LIKE ? OR p.Barcode LIKE ? OR c.Name LIKE ?)`;
      params = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`];
    } else if (lowerQuery.includes('ناقص') || lowerQuery.includes('قريب ينفذ') || lowerQuery.includes('low stock')) {
      sql += ` AND p.Quantity <= p.MinQuantity`;
    }

    sql += ` ORDER BY p.Quantity ASC LIMIT 10`;

    const products = getQueryResult(db, sql, params);

    if (products.length === 0) {
      return {
        toolName: 'SearchProduct',
        data: [],
        textResponse: `🔍 لم أجد أي منتج يطابق بحثك ("${keyword || userQuery}") في قاعدة بيانات المحل.`
      };
    }

    let text = `📦 **نتائج البحث في المخزون (${products.length} منتجات):**\n\n`;
    products.forEach((p: any) => {
      const isLow = p.Quantity <= p.MinQuantity;
      const statusIcon = isLow ? '⚠️ [مخزون منخفض]' : '✅';
      text += `${statusIcon} **${p.Name}** (${p.Barcode})\n` +
        `   • الكمية المتوفرة: **${p.Quantity} ${p.Unit}**\n` +
        `   • سعر البيع: ${p.SalePrice.toLocaleString('ar-DZ')} دج (سعر الشراء: ${p.PurchasePrice.toLocaleString('ar-DZ')} دج)\n` +
        `   • التصنيف: ${p.CategoryName || 'عام'}\n\n`;
    });

    return {
      toolName: 'SearchProduct',
      data: products,
      textResponse: text
    };
  }

  // Tool 5: Expenses query ("المصاريف", "شحال صرفت؟")
  if (lowerQuery.includes('مصاريف') || lowerQuery.includes('صرفت') || lowerQuery.includes('مصروف')) {
    const todayStr = new Date().toISOString().substring(0, 10);
    const expRes = getQueryResult(db, `SELECT e.*, c.Name as CategoryName FROM Expenses e LEFT JOIN ExpenseCategories c ON e.CategoryId = c.Id ORDER BY e.ExpenseDate DESC LIMIT 10`);
    const totalExp = expRes.reduce((sum: number, e: any) => sum + e.Amount, 0);

    let text = `💸 **تقرير المصاريف المسجلة في النظام:**\n\n`;
    expRes.forEach((e: any) => {
      text += `• **${e.Title}** (${e.CategoryName}): ${e.Amount.toLocaleString('ar-DZ')} دج — *${e.ExpenseDate}*\n`;
    });
    text += `\n📊 **إجمالي المصاريف:** **${totalExp.toLocaleString('ar-DZ')} دج**`;

    return {
      toolName: 'GetExpenses',
      data: expRes,
      textResponse: text
    };
  }

  // Fallback: Default Helpful Assistant Guidance
  const countProd = getQueryResult(db, `SELECT COUNT(*) as C FROM Products WHERE IsDeleted = 0`)[0]?.C || 0;
  const countSales = getQueryResult(db, `SELECT COUNT(*) as C FROM Sales`)[0]?.C || 0;

  return {
    toolName: 'GeneralAssistant',
    data: { countProd, countSales },
    textResponse: `مرحباً بك في **مساعد ميزان الذكي 🤖**! أنا هنا لمساعدتك في إدارة المحل.\n\n` +
      `يمكنك سؤالي باللهجة الجزائرية أو العربية الفصحى مثل:\n` +
      `• *"واش عندي من زيت؟"*\n` +
      `• *"شحال بعت اليوم؟"*\n` +
      `• *"شحال ربحت اليوم؟"*\n` +
      `• *"محمد شحال عليه؟"*\n` +
      `• *"كاين حليب ناقص؟"*\n\n` +
      `📊 **إحصائيات النظام حالياً:** ${countProd} منتج مسجل | ${countSales} عملية بيع.`
  };
}

function getQueryResult(db: Database, query: string, params: any[] = []): any[] {
  try {
    const stmt = db.prepare(query);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('SQL Execution Error:', err);
    return [];
  }
}

function calculateSystemProfit(db: Database, period: string = 'today') {
  let dateFilter = '';
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);

  if (period === 'today') {
    dateFilter = `strftime('%Y-%m-%d', CreatedAt) = '${todayStr}'`;
  } else if (period === 'month') {
    const monthStr = now.toISOString().substring(0, 7);
    dateFilter = `strftime('%Y-%m', CreatedAt) = '${monthStr}'`;
  } else {
    dateFilter = `1=1`;
  }

  // 1. Total Revenue
  const salesQuery = `SELECT SUM(GrandTotal) as TotalRev FROM Sales WHERE ${dateFilter}`;
  const totalRev = getQueryResult(db, salesQuery)[0]?.TotalRev || 0;

  // 2. Cost of Goods Sold (COGS)
  const cogsQuery = `
    SELECT SUM(si.CostPrice * si.Quantity) as TotalCost 
    FROM SaleItems si 
    JOIN Sales s ON si.SaleId = s.Id 
    WHERE ${dateFilter.replace('CreatedAt', 's.CreatedAt')}
  `;
  const totalCogs = getQueryResult(db, cogsQuery)[0]?.TotalCost || 0;

  // 3. Expenses
  let expFilter = period === 'today' 
    ? `ExpenseDate = '${todayStr}'`
    : (period === 'month' ? `ExpenseDate LIKE '${now.toISOString().substring(0, 7)}%'` : `1=1`);
  const expQuery = `SELECT SUM(Amount) as TotalExp FROM Expenses WHERE ${expFilter}`;
  const totalExp = getQueryResult(db, expQuery)[0]?.TotalExp || 0;

  const grossProfit = totalRev - totalCogs;
  const netProfit = grossProfit - totalExp;

  return {
    periodLabel: period === 'today' ? 'اليوم' : (period === 'month' ? 'هذا الشهر' : 'الكل'),
    revenue: totalRev,
    cogs: totalCogs,
    grossProfit,
    expenses: totalExp,
    netProfit
  };
}
