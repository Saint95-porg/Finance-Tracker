// js/advisor.js

const RULES = {
  savingsRate: { healthy: 20, warning: 10 },
  needsMax:    50,
  wantsMax:    30,
};

const NEEDS = ['Rent', 'Bills', 'Food', 'Health', 'Transport'];
const WANTS = ['Shopping', 'Entertainment', 'Other'];

export function analyzeFinances(transactions) {
  console.log('🧠 Advisor received:', transactions.length, 'transactions');

  if (!transactions || transactions.length === 0) {
    return { score: null, insights: [], empty: true };
  }

  const now = new Date();

  // ── Get this month's transactions ──
  // Use let so we can reassign if empty
  let thisMonth = getThisMonthTransactions(transactions, now);

  // Fallback — if no transactions this month use all of them
  if (thisMonth.length === 0) {
    console.log('⚠️ No transactions this month — using all transactions');
    thisMonth = transactions.slice(); // .slice() makes a copy
  }

  const lastMonth  = getLastMonthTransactions(transactions, now);
  const income     = sumByType(thisMonth, 'income');
  const expenses   = sumByType(thisMonth, 'expense');
  const byCategory = groupByCategory(thisMonth);

  console.log('📊 This month — income:', income, 'expenses:', expenses);

  const insights  = [];
  let scoreTotal  = 0;
  let scoreCount  = 0;

  // ── 1. SAVINGS RATE ──────────────────────────────────────
  if (income > 0) {
    const saved       = income - expenses;
    const savingsRate = (saved / income) * 100;
    scoreCount++;

    if (savingsRate >= RULES.savingsRate.healthy) {
      scoreTotal += 100;
      insights.push({
        type:    'success',
        icon:    '🏆',
        title:   'Great savings rate',
        message: `You are saving ${Math.round(savingsRate)}% of your income this month. ` +
                 `That is above the recommended 20%. Keep it up.`,
        metric:  Math.round(savingsRate) + '%',
        label:   'Savings rate'
      });
    } else if (saved < 0) {
      scoreTotal += 0;
      insights.push({
        type:    'danger',
        icon:    '🚨',
        title:   'Spending exceeds income',
        message: `You have spent ${fmt(Math.abs(saved))} more than you have earned this month. ` +
                 `Review your expenses immediately.`,
        metric:  fmt(Math.abs(saved)),
        label:   'Overspend'
      });
    } else if (savingsRate >= RULES.savingsRate.warning) {
      scoreTotal += 50;
      insights.push({
        type:    'warning',
        icon:    '⚠️',
        title:   'Savings rate is low',
        message: `You are saving ${Math.round(savingsRate)}% of your income. ` +
                 `Try to reach 20% by reducing discretionary spending.`,
        metric:  Math.round(savingsRate) + '%',
        label:   'Savings rate'
      });
    } else {
      scoreTotal += 20;
      insights.push({
        type:    'danger',
        icon:    '📉',
        title:   'Savings rate critically low',
        message: `You are only saving ${Math.round(savingsRate)}% of your income. ` +
                 `Aim for at least 20% to build financial security.`,
        metric:  Math.round(savingsRate) + '%',
        label:   'Savings rate'
      });
    }
  } else {
    // No income recorded yet — only expenses
    if (expenses > 0) {
      scoreCount++;
      scoreTotal += 20;
      insights.push({
        type:    'warning',
        icon:    '💡',
        title:   'No income recorded',
        message: `You have ${fmt(expenses)} in expenses but no income recorded this period. ` +
                 `Add your income transactions to get a full picture.`,
        metric:  fmt(expenses),
        label:   'Total expenses'
      });
    }
  }

  // ── 2. 50/30/20 RULE ─────────────────────────────────────
  if (income > 0) {
    const needsTotal = NEEDS.reduce((s, c) => s + (byCategory[c] || 0), 0);
    const wantsTotal = WANTS.reduce((s, c) => s + (byCategory[c] || 0), 0);
    const needsPct   = (needsTotal / income) * 100;
    const wantsPct   = (wantsTotal / income) * 100;
    scoreCount++;

    if (needsPct <= RULES.needsMax && wantsPct <= RULES.wantsMax) {
      scoreTotal += 100;
      insights.push({
        type:    'success',
        icon:    '✅',
        title:   '50/30/20 rule on track',
        message: `Needs: ${Math.round(needsPct)}% · Wants: ${Math.round(wantsPct)}% · ` +
                 `Savings: ${Math.round(100 - needsPct - wantsPct)}%. ` +
                 `Your spending split looks healthy.`,
        metric:  Math.round(needsPct) + '/' + Math.round(wantsPct),
        label:   'Needs/Wants %'
      });
    } else {
      scoreTotal += 30;
      const parts = [];
      if (needsPct > RULES.needsMax) parts.push(`Needs are at ${Math.round(needsPct)}% (target: 50%)`);
      if (wantsPct > RULES.wantsMax) parts.push(`Wants are at ${Math.round(wantsPct)}% (target: 30%)`);
      insights.push({
        type:    'warning',
        icon:    '⚖️',
        title:   '50/30/20 rule off balance',
        message: parts.join('. ') + '. Review your spending split.',
        metric:  Math.round(needsPct) + '/' + Math.round(wantsPct),
        label:   'Needs/Wants %'
      });
    }
  }

  // ── 3. MONTH-ON-MONTH CHANGE ─────────────────────────────
  if (lastMonth.length > 0) {
    const lastExpenses = sumByType(lastMonth, 'expense');
    const thisExpenses = sumByType(thisMonth, 'expense');

    if (lastExpenses > 0) {
      const changePct = ((thisExpenses - lastExpenses) / lastExpenses) * 100;
      scoreCount++;

      if (changePct <= 0) {
        scoreTotal += 100;
        insights.push({
          type:    'success',
          icon:    '📊',
          title:   'Spending down vs last month',
          message: `You have spent ${Math.abs(Math.round(changePct))}% less than last month. ` +
                   `Great discipline — ${fmt(lastExpenses - thisExpenses)} saved.`,
          metric:  '-' + Math.abs(Math.round(changePct)) + '%',
          label:   'vs last month'
        });
      } else if (changePct <= 15) {
        scoreTotal += 70;
        insights.push({
          type:    'warning',
          icon:    '📈',
          title:   'Spending up slightly',
          message: `You have spent ${Math.round(changePct)}% more than last month ` +
                   `(+${fmt(thisExpenses - lastExpenses)}). Watch your discretionary spending.`,
          metric:  '+' + Math.round(changePct) + '%',
          label:   'vs last month'
        });
      } else {
        scoreTotal += 20;
        insights.push({
          type:    'danger',
          icon:    '🔺',
          title:   'Spending spike vs last month',
          message: `Expenses are up ${Math.round(changePct)}% vs last month ` +
                   `(+${fmt(thisExpenses - lastExpenses)}). Identify which categories spiked.`,
          metric:  '+' + Math.round(changePct) + '%',
          label:   'vs last month'
        });
      }
    }
  }

  // ── 4. BURN RATE ─────────────────────────────────────────
  if (income > 0 && expenses > 0) {
    const dayOfMonth  = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected   = (expenses / dayOfMonth) * daysInMonth;
    const burnPct     = (projected / income) * 100;
    scoreCount++;

    if (burnPct <= 80) {
      scoreTotal += 100;
      insights.push({
        type:    'success',
        icon:    '🔥',
        title:   'Burn rate is healthy',
        message: `At your current pace you will spend about ${fmt(projected)} this month, ` +
                 `which is ${Math.round(burnPct)}% of your income. You are on track.`,
        metric:  fmt(projected),
        label:   'Projected spend'
      });
    } else if (burnPct <= 100) {
      scoreTotal += 50;
      insights.push({
        type:    'warning',
        icon:    '⏱️',
        title:   'High burn rate',
        message: `At this pace you will spend ${fmt(projected)} by end of month — ` +
                 `${Math.round(burnPct)}% of your income. Slow down spending now.`,
        metric:  fmt(projected),
        label:   'Projected spend'
      });
    } else {
      scoreTotal += 0;
      insights.push({
        type:    'danger',
        icon:    '💸',
        title:   'On track to overspend',
        message: `Projected end-of-month spend is ${fmt(projected)} — ` +
                 `${Math.round(burnPct - 100)}% over your income. Immediate action needed.`,
        metric:  fmt(projected),
        label:   'Projected spend'
      });
    }
  }

  // ── 5. TOP SPENDING CATEGORY ─────────────────────────────
  const catEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const topCat     = catEntries[0];

  if (topCat && income > 0) {
    const topPct = (topCat[1] / income) * 100;
    scoreCount++;

    if (topPct > 40) {
      scoreTotal += 20;
      insights.push({
        type:    'danger',
        icon:    '🎯',
        title:   topCat[0] + ' is dominating your budget',
        message: topCat[0] + ' accounts for ' + Math.round(topPct) + '% of your income ' +
                 '(' + fmt(topCat[1]) + '). Consider if this aligns with your priorities.',
        metric:  Math.round(topPct) + '%',
        label:   'of income'
      });
    } else if (topPct > 25) {
      scoreTotal += 70;
      insights.push({
        type:    'warning',
        icon:    '👀',
        title:   'Watch your ' + topCat[0] + ' spending',
        message: topCat[0] + ' is your biggest expense at ' + Math.round(topPct) + '% of income ' +
                 '(' + fmt(topCat[1]) + '). Keep an eye on it.',
        metric:  Math.round(topPct) + '%',
        label:   'of income'
      });
    } else {
      scoreTotal += 100;
      insights.push({
        type:    'success',
        icon:    '🎉',
        title:   'Spending well distributed',
        message: 'No single category dominates your budget. ' +
                 'Your biggest spend is ' + topCat[0] + ' at ' + Math.round(topPct) + '% of income.',
        metric:  Math.round(topPct) + '%',
        label:   'Top category'
      });
    }
  }

  // ── OVERALL SCORE ─────────────────────────────────────────
  const finalScore = scoreCount > 0 ? Math.round(scoreTotal / scoreCount) : 0;

  // Use different variable names to avoid any collision
  const gradeKey = finalScore >= 80 ? 'excellent'
                 : finalScore >= 60 ? 'good'
                 : finalScore >= 40 ? 'fair'
                 : 'poor';

  const gradeLabel = finalScore >= 80 ? 'Excellent'
                   : finalScore >= 60 ? 'Good'
                   : finalScore >= 40 ? 'Needs Work'
                   : 'At Risk';

  const gradeMessage = finalScore >= 80
    ? 'Your finances are in great shape. Keep up the discipline.'
    : finalScore >= 60
    ? 'You are doing well but there is room for improvement.'
    : finalScore >= 40
    ? 'Some areas need attention. Review the insights below.'
    : 'Your financial health needs immediate attention.';

  console.log('✅ Advisor score:', finalScore, gradeKey, '| Insights:', insights.length);

  return {
    score:        finalScore,
    scoreGrade:   gradeKey,
    scoreLabel:   gradeLabel,
    scoreMessage: gradeMessage,
    insights:     insights,
    empty:        false
  };
}


// ── HELPERS ───────────────────────────────────────────────

function getThisMonthTransactions(transactions, now) {
  return transactions.filter(function(t) {
    if (t.createdAt?.toDate) {
      const d = t.createdAt.toDate();
      return d.getMonth() === now.getMonth() &&
             d.getFullYear() === now.getFullYear();
    }
    if (t.createdAt instanceof Date) {
      return t.createdAt.getMonth() === now.getMonth() &&
             t.createdAt.getFullYear() === now.getFullYear();
    }
    // Timestamp not resolved yet — assume current month
    return true;
  });
}

function getLastMonthTransactions(transactions, now) {
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return transactions.filter(function(t) {
    if (t.createdAt?.toDate) {
      const d = t.createdAt.toDate();
      return d.getMonth() === lastMonth.getMonth() &&
             d.getFullYear() === lastMonth.getFullYear();
    }
    if (t.createdAt instanceof Date) {
      return t.createdAt.getMonth() === lastMonth.getMonth() &&
             t.createdAt.getFullYear() === lastMonth.getFullYear();
    }
    return false;
  });
}

function sumByType(list, type) {
  return list
    .filter(function(t) { return t.type === type; })
    .reduce(function(s, t) { return s + t.amount; }, 0);
}

function groupByCategory(list) {
  return list
    .filter(function(t) { return t.type === 'expense'; })
    .reduce(function(acc, t) {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
}

function fmt(amount) {
  return '₦' + Math.abs(amount).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}