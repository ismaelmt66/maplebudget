# NexLedger User Guide

## Getting Started

### 1. Create an Account
Navigate to the **Register** page and enter your email and password (minimum 8 characters).

### 2. Onboarding
After registration, you'll be guided through:
- **Category setup**: Choose default expense/income categories or create custom ones
- **Profile setup**: Set your currency, country, and financial preferences
- **Budget limits**: Set monthly spending limits per category

### 3. Dashboard
The main dashboard shows:
- **KPI cards**: Income, expenses, net balance, transaction count
- **Trend chart**: Interactive chart showing income vs expenses over time
- **Health score**: Your financial health score (0-100) with breakdown
- **Budget alerts**: Categories approaching or exceeding their budget limits
- **AI forecast**: Projected cash flow for the rest of the month

## Managing Transactions

### Adding Transactions
- Use the **Quick Add** button (floating button) for fast entry
- Navigate to **Finances > Transactions** for the full transaction form
- Each transaction requires: amount, date, and category

### Importing Transactions
Go to **Tools > Import** to:
- **CSV Import**: Upload a CSV file with Date, Amount, and Description columns
- **OFX/QFX Import**: Upload bank statement files directly
- **Bank Connection**: Connect your bank via Plaid for automatic import

#### CSV Format
Your CSV should have headers like:
```
Date,Amount,Description,Category
2026-01-15,42.50,Grocery Store,Food
2026-01-16,15.00,Coffee Shop,Entertainment
```

Supported date formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`.

### Editing & Deleting
Navigate to **Finances > Transactions** to:
- Click a transaction to edit its details
- Use the delete button to remove transactions

## Budget Management

### Categories
Go to **Finances > Categories** to:
- Create income and expense categories
- Set monthly budget limits
- View spending per category

### Budget Alerts
Go to **Finances > Budget** to:
- Set alerts for specific category spending thresholds
- View which categories are over budget
- Get real-time notifications when approaching limits

## Financial Goals

Navigate to **Planning > Goals** to:
- Create savings goals with target amounts and dates
- Track progress with visual progress bars
- Get AI recommendations for achieving goals faster

## Financial Health Score

Your health score (0-100) is calculated from:
- **Savings Rate** (25 pts): % of income saved
- **Budget Compliance** (25 pts): Categories within budget
- **Emergency Fund** (25 pts): Months of expenses covered by liquid assets
- **Goal Progress** (20 pts): Progress toward financial goals
- **Diversification** (5 pts): Variety of asset types

## AI Coach (Nexus)

Click the **Nexus** widget (bottom-right) to chat with your AI financial coach.

Try these commands:
- `bilan complet` — Full 360° financial report
- `épargne` — Savings analysis and FI number
- `dépenses` — Spending breakdown and optimization
- `objectifs` — Goal feasibility analysis
- `anomalies` — Unusual transaction detection
- `abonnements` — Subscription audit

## Gamification

### Achievements
Earn badges by completing financial milestones:
- First transaction, 50+ transactions, 100+ transactions
- Setting goals, connecting a bank, budget compliance
- And more...

### Challenges
Weekly personalized challenges based on your spending habits:
- Reduce top spending category by 20%
- Weekly savings targets
- No-impulse-buy challenges

### Levels
Progress through levels by earning XP (100 XP per achievement):
- Débutant (0-200 XP)
- Apprenti (200-400 XP)
- Expert (400-700 XP)
- Maître (700-1000 XP)
- Gourou (1000+ XP)

## Export & Reports

### CSV Export
Go to **Tools > Export** to download transactions as CSV with date range filters.

### Monthly PDF Report
Generate a formatted HTML report (printable to PDF) from **Insights > Reports**.

## Security

### Two-Factor Authentication (2FA)
Go to **Account > Security** to enable TOTP-based 2FA using apps like Google Authenticator.

### Password Change
Change your password from **Account > Security**. Minimum 8 characters required.

### Audit Log
View your account activity history in **Account > Security > Audit Logs**.
