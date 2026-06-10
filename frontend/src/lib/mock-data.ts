import type { Bill, Member, Expense, Notification } from "@/types";

export const mockMembers: Member[] = [
  { id: "1", name: "You", email: "you@example.com" },
  { id: "2", name: "Alice", email: "alice@example.com" },
  { id: "3", name: "Bob", email: "bob@example.com" },
  { id: "4", name: "Charlie", email: "charlie@example.com" },
];

const sharedMembers = mockMembers.slice(0, 3);

export const mockBills: Bill[] = [
  {
    id: "1",
    title: "Weekend Groceries",
    description: "Costco run for the house",
    members: sharedMembers,
    expenses: [
      { id: "e1", description: "Groceries", amount: 156.73, paidBy: "1", date: "2026-06-08" },
      { id: "e2", description: "Snacks", amount: 23.50, paidBy: "2", date: "2026-06-08" },
    ],
    status: "open",
    createdAt: "2026-06-08T10:00:00Z",
    updatedAt: "2026-06-08T10:00:00Z",
  },
  {
    id: "2",
    title: "Electric Bill",
    description: "Monthly electricity",
    members: mockMembers,
    expenses: [
      { id: "e3", description: "Electricity", amount: 210.40, paidBy: "1", date: "2026-06-01" },
    ],
    status: "settled",
    createdAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-06-05T12:00:00Z",
  },
  {
    id: "3",
    title: "Dinner at Italian Place",
    description: "Friday night dinner",
    members: sharedMembers,
    expenses: [
      { id: "e4", description: "Pasta & wine", amount: 89.20, paidBy: "3", date: "2026-05-30" },
      { id: "e5", description: "Tiramisu", amount: 12.00, paidBy: "3", date: "2026-05-30" },
    ],
    status: "open",
    createdAt: "2026-05-30T20:00:00Z",
    updatedAt: "2026-05-30T20:00:00Z",
  },
  {
    id: "4",
    title: "Internet",
    description: "Monthly ISP",
    members: mockMembers,
    expenses: [
      { id: "e6", description: "Internet", amount: 79.99, paidBy: "2", date: "2026-06-01" },
    ],
    status: "open",
    createdAt: "2026-06-01T09:00:00Z",
    updatedAt: "2026-06-01T09:00:00Z",
  },
  {
    id: "5",
    title: "Netflix",
    description: "Shared streaming",
    members: sharedMembers,
    expenses: [
      { id: "e7", description: "Monthly sub", amount: 22.99, paidBy: "1", date: "2026-06-05" },
    ],
    status: "settled",
    createdAt: "2026-06-05T14:00:00Z",
    updatedAt: "2026-06-06T10:00:00Z",
  },
];

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "bill_settled",
    title: "Bill Settled",
    description: "Electric Bill has been fully settled. Everyone is paid up.",
    time: "2026-06-05T12:00:00Z",
    read: false,
    billId: "2",
  },
  {
    id: "n2",
    type: "payment_received",
    title: "Payment Received",
    description: "Alice paid you $52.24 for Weekend Groceries.",
    time: "2026-06-09T14:30:00Z",
    read: false,
    billId: "1",
  },
  {
    id: "n3",
    type: "bill_added",
    title: "New Bill Created",
    description: "Bob created Dinner at Italian Place — $101.20 total.",
    time: "2026-05-30T20:00:00Z",
    read: true,
    billId: "3",
  },
  {
    id: "n4",
    type: "member_joined",
    title: "Member Joined",
    description: "Charlie has joined your household group.",
    time: "2026-06-01T09:15:00Z",
    read: false,
  },
  {
    id: "n5",
    type: "bill_added",
    title: "New Bill Created",
    description: "Alice created Internet bill — $79.99 for this month.",
    time: "2026-06-01T09:00:00Z",
    read: true,
    billId: "4",
  },
  {
    id: "n6",
    type: "payment_received",
    title: "Payment Received",
    description: "Bob paid you $33.73 for Weekend Groceries.",
    time: "2026-06-08T16:45:00Z",
    read: false,
    billId: "1",
  },
  {
    id: "n7",
    type: "bill_settled",
    title: "Bill Settled",
    description: "Netflix subscription is now settled. No outstanding balances.",
    time: "2026-06-06T10:00:00Z",
    read: true,
    billId: "5",
  },
  {
    id: "n8",
    type: "member_joined",
    title: "Member Joined",
    description: "Alice has joined your household group.",
    time: "2026-06-01T09:10:00Z",
    read: true,
  },
];
