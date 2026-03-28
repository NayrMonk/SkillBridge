import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  CreditCard,
  Banknote,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const transactionTypes: Record<string, { label: string; icon: any; color: string }> = {
  deposit: { label: 'Deposit', icon: ArrowDownLeft, color: 'text-green-500' },
  withdrawal: { label: 'Withdrawal', icon: ArrowUpRight, color: 'text-red-500' },
  payment: { label: 'Payment', icon: DollarSign, color: 'text-blue-500' },
  refund: { label: 'Refund', icon: ArrowDownLeft, color: 'text-green-500' },
  escrow_deposit: { label: 'Escrow Deposit', icon: DollarSign, color: 'text-yellow-500' },
  escrow_release: { label: 'Escrow Release', icon: DollarSign, color: 'text-green-500' },
  platform_fee: { label: 'Platform Fee', icon: DollarSign, color: 'text-red-500' },
  promotion_payment: { label: 'Promotion', icon: DollarSign, color: 'text-purple-500' }
};

const transactionStatuses: Record<string, { label: string; variant: any }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' }
};

export const WalletPage = () => {
  const { updateWallet } = useAuthStore();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Deposit dialog
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  
  // Withdraw dialog
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('bank');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [activeTab]);

  const fetchWallet = async () => {
    try {
      setIsLoading(true);
      const response = await api.getWallet();
      setWallet(response.wallet);
      updateWallet({
        balance: response.wallet.balance,
        escrowBalance: response.wallet.escrow_balance
      });
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
      toast.error('Failed to load wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setIsLoadingTransactions(true);
      const params: any = {};
      if (activeTab !== 'all') {
        params.type = activeTab;
      }
      const response = await api.getTransactions(params);
      setTransactions(response.transactions);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount < 10) {
      toast.error('Minimum deposit amount is $10');
      return;
    }

    try {
      setIsDepositing(true);
      // In a real implementation, this would create a Stripe payment intent
      // and redirect to Stripe checkout
      toast.info('Stripe integration required for actual payments');
      setShowDepositDialog(false);
      setDepositAmount('');
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Failed to process deposit');
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 50) {
      toast.error('Minimum withdrawal amount is $50');
      return;
    }

    if (amount > wallet.balance) {
      toast.error('Insufficient balance');
      return;
    }

    try {
      setIsWithdrawing(true);
      await api.withdraw(amount, withdrawMethod, {});
      toast.success('Withdrawal request submitted');
      setShowWithdrawDialog(false);
      setWithdrawAmount('');
      fetchWallet();
      fetchTransactions();
    } catch (error: any) {
      console.error('Withdraw error:', error);
      toast.error(error.response?.data?.error || 'Failed to process withdrawal');
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Wallet</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wallet</h1>
          <p className="text-ink-4 mt-1">
            Manage your funds and transactions
          </p>
        </div>
        <Button variant="outline" onClick={fetchWallet}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-brand text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Available Balance</p>
                <p className="text-3xl font-bold">${wallet?.balance?.toLocaleString() || '0'}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-4 text-sm">In Escrow</p>
                <p className="text-3xl font-bold">${wallet?.escrow_balance?.toLocaleString() || '0'}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-4 text-sm">Total Earned</p>
                <p className="text-3xl font-bold">${wallet?.total_deposited?.toLocaleString() || '0'}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <ArrowDownLeft className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
          <DialogTrigger asChild>
            <Button className="flex-1">
              <ArrowDownLeft className="mr-2 h-4 w-4" />
              Deposit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount (min $10)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
              <div className="p-4 bg-canvas rounded-lg">
                <p className="text-sm text-ink-4">
                  You will be redirected to Stripe to complete your payment securely.
                </p>
              </div>
              <Button 
                className="w-full" 
                onClick={handleDeposit}
                disabled={isDepositing}
              >
                {isDepositing ? 'Processing...' : 'Proceed to Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="withdrawAmount">Amount (USD)</Label>
                <Input
                  id="withdrawAmount"
                  type="number"
                  placeholder="Enter amount (min $50)"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <p className="text-xs text-ink-4 mt-1">
                  Available: ${wallet?.balance?.toLocaleString() || '0'}
                </p>
              </div>
              <div>
                <Label htmlFor="method">Withdrawal Method</Label>
                <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Bank Transfer
                      </div>
                    </SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full" 
                onClick={handleWithdraw}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? 'Processing...' : 'Request Withdrawal'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="deposit">Deposits</TabsTrigger>
              <TabsTrigger value="withdrawal">Withdrawals</TabsTrigger>
              <TabsTrigger value="escrow">Escrow</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {isLoadingTransactions ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-ink-4 mx-auto mb-4" />
                  <p className="text-ink-4">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((transaction) => {
                    const typeInfo = transactionTypes[transaction.type] || transactionTypes.payment;
                    const statusInfo = transactionStatuses[transaction.status] || transactionStatuses.pending;
                    const Icon = typeInfo.icon;

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-canvas/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-full bg-canvas flex items-center justify-center ${typeInfo.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{typeInfo.label}</p>
                            <p className="text-sm text-ink-4">
                              {transaction.description || 'No description'}
                            </p>
                            <p className="text-xs text-ink-4">
                              {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${typeInfo.color}`}>
                            {transaction.type === 'deposit' || transaction.type === 'escrow_release' || transaction.type === 'refund'
                              ? '+'
                              : '-'
                            }
                            ${transaction.amount?.toLocaleString()}
                          </p>
                          <Badge variant={statusInfo.variant} className="text-xs">
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
