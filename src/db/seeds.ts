export const PREDEFINED_CATEGORIES: Array<{
  name: string;
  icon: string;
  color: string;
}> = [
  { name: 'Food', icon: 'food', color: '#EF6C00' },
  { name: 'Groceries', icon: 'cart', color: '#43A047' },
  { name: 'Transport', icon: 'bus', color: '#1E88E5' },
  { name: 'Bills', icon: 'flash', color: '#FB8C00' },
  { name: 'Rent', icon: 'home', color: '#6D4C41' },
  { name: 'Shopping', icon: 'shopping', color: '#D81B60' },
  { name: 'Health', icon: 'heart-pulse', color: '#E53935' },
  { name: 'Entertainment', icon: 'movie-open', color: '#8E24AA' },
  { name: 'Education', icon: 'school', color: '#3949AB' },
  { name: 'Travel', icon: 'airplane', color: '#00897B' },
  { name: 'Other', icon: 'dots-horizontal', color: '#546E7A' },
];

export const PREDEFINED_PAYMENT_METHODS: Array<{
  name: string;
  icon: string;
}> = [
  { name: 'Cash', icon: 'cash' },
  { name: 'UPI', icon: 'cellphone-link' },
  { name: 'Credit Card', icon: 'credit-card' },
  { name: 'Debit Card', icon: 'credit-card-outline' },
  { name: 'Bank Transfer', icon: 'bank' },
  { name: 'Wallet', icon: 'wallet' },
];
