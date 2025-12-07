import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { usePayment } from '@/contexts/payment-context';
import { PaymentType, PaymentPlatform } from '@/config/payment-config';
import { Coffee, Coins, CreditCard, DollarSign, Gift, Heart } from 'lucide-react';

interface DonationModalProps {
  // This component can be used with or without a trigger
  // If trigger is provided, it will be used as the button to open the modal
  // If no trigger is provided, the modal will be controlled by the context
  trigger?: React.ReactNode;
}

export const DonationModal: React.FC<DonationModalProps> = ({ trigger }) => {
  const { 
    paymentType, 
    setPaymentType, 
    selectedAmount, 
    setSelectedAmount, 
    isModalOpen, 
    closeModal, 
    config 
  } = usePayment();

  // Handle PayPal donation
  const handlePayPalDonate = () => {
    // Construct PayPal donate URL
    const paypalUrl = `https://www.paypal.com/donate/?business=${config.donation.paypal.businessId}&amount=${selectedAmount}&currency_code=${config.donation.currency}`;
    window.open(paypalUrl, '_blank');
  };

  // Handle Buy Me a Coffee donation
  const handleBuyMeACoffeeDonate = () => {
    // Construct Buy Me a Coffee URL
    const bmcUrl = `https://www.buymeacoffee.com/${config.donation.buyMeACoffee.username}?amount=${selectedAmount}&currency=${config.donation.currency}`;
    window.open(bmcUrl, '_blank');
  };

  // Render donation amount options
  const renderDonationAmounts = () => {
    return (
      <div className="grid grid-cols-2 gap-3">
        {config.donation.amounts.map((amount) => (
          <Button
            key={amount.value}
            variant={selectedAmount === amount.value ? "default" : "outline"}
            onClick={() => setSelectedAmount(amount.value)}
            className="h-12 justify-between"
          >
            <span>{amount.label}</span>
            {selectedAmount === amount.value && <Heart className="h-4 w-4 text-red-500" />}
          </Button>
        ))}
      </div>
    );
  };

  // Render payment methods
  const renderPaymentMethods = () => {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Choose Payment Method</h3>
        
        {/* PayPal Button */}
        {config.enabledPlatforms.includes(PaymentPlatform.PAYPAL) && (
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={handlePayPalDonate}
          >
            <Coins className="h-5 w-5" />
            <span>PayPal</span>
            <CreditCard className="h-4 w-4 ml-auto text-muted-foreground" />
          </Button>
        )}
        
        {/* Buy Me a Coffee Button */}
        {config.enabledPlatforms.includes(PaymentPlatform.BUY_ME_A_COFFEE) && (
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={handleBuyMeACoffeeDonate}
          >
            <Coffee className="h-5 w-5 text-amber-600" />
            <span>Buy Me a Coffee</span>
            <CreditCard className="h-4 w-4 ml-auto text-muted-foreground" />
          </Button>
        )}
      </div>
    );
  };



  // If this component is used with a trigger, wrap it in DialogTrigger
  if (trigger) {
    return (
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DonationModalContent />
        </DialogContent>
      </Dialog>
    );
  }

  // Otherwise, just render the content (controlled by context)
  return (
    <Dialog open={isModalOpen} onOpenChange={closeModal}>
      <DialogContent className="sm:max-w-[600px]">
        <DonationModalContent />
      </DialogContent>
    </Dialog>
  );
};

// Internal component for the modal content
const DonationModalContent: React.FC = () => {
  const { 
    paymentType, 
    setPaymentType, 
    selectedAmount, 
    setSelectedAmount, 
    config 
  } = usePayment();

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          {config.ui.modalTitle}
        </DialogTitle>
        <DialogDescription>
          Your support helps us continue to improve CardAll and provide you with the best experience possible.
        </DialogDescription>
      </DialogHeader>
      
      <Tabs 
        value={paymentType} 
        onValueChange={(value) => setPaymentType(value as PaymentType)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value={PaymentType.ONE_TIME}>
            <DollarSign className="h-4 w-4 mr-2" />
            One-time Donation
          </TabsTrigger>
          {config.ui.showSubscriptionOption && (
            <TabsTrigger value={PaymentType.SUBSCRIPTION}>
              <CreditCard className="h-4 w-4 mr-2" />
              Subscribe
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value={PaymentType.ONE_TIME} className="space-y-4">
          {/* Donation Amount Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choose Amount</CardTitle>
              <CardDescription>
                Select how much you'd like to donate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {config.donation.amounts.map((amount) => (
                    <Button
                      key={amount.value}
                      variant={selectedAmount === amount.value ? "default" : "outline"}
                      onClick={() => setSelectedAmount(amount.value)}
                      className="h-12 justify-between"
                    >
                      <span>{amount.label}</span>
                      {selectedAmount === amount.value && <Heart className="h-4 w-4 text-red-500" />}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Methods</CardTitle>
              <CardDescription>
                Choose your preferred payment method
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* PayPal Button */}
                {config.enabledPlatforms.includes(PaymentPlatform.PAYPAL) && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      const paypalUrl = `https://www.paypal.com/donate/?business=${config.donation.paypal.businessId}&amount=${selectedAmount}&currency_code=${config.donation.currency}`;
                      window.open(paypalUrl, '_blank');
                    }}
                  >
                    <Coins className="h-5 w-5" />
                    <span>PayPal</span>
                    <CreditCard className="h-4 w-4 ml-auto text-muted-foreground" />
                  </Button>
                )}
                
                {/* Buy Me a Coffee Button */}
                {config.enabledPlatforms.includes(PaymentPlatform.BUY_ME_A_COFFEE) && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      const bmcUrl = `https://www.buymeacoffee.com/${config.donation.buyMeACoffee.username}?amount=${selectedAmount}&currency=${config.donation.currency}`;
                      window.open(bmcUrl, '_blank');
                    }}
                  >
                    <Coffee className="h-5 w-5 text-amber-600" />
                    <span>Buy Me a Coffee</span>
                    <CreditCard className="h-4 w-4 ml-auto text-muted-foreground" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {config.ui.showSubscriptionOption && (
          <TabsContent value={PaymentType.SUBSCRIPTION}>
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Monthly Subscription Plans
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Unlock premium features and support our development with our upcoming subscription plans!
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Plan - Coming Soon */}
                <Card className="border-dashed border-2 border-muted hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Basic</CardTitle>
                    <CardDescription>Perfect for casual users</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">$4.99</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                          </div>
                          <span className="text-sm">Unlimited cards</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                          </div>
                          <span className="text-sm">Basic analytics</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                          </div>
                          <span className="text-sm">Email support</span>
                        </li>
                      </ul>
                      
                      <Button variant="default" className="w-full" disabled>
                        Coming Soon
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Pro Plan - Coming Soon */}
                <Card className="border-dashed border-2 border-muted hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Pro</CardTitle>
                    <CardDescription>For power users</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">$9.99</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                          </div>
                          <span className="text-sm">All Basic features</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                          </div>
                          <span className="text-sm">Advanced analytics</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                          </div>
                          <span className="text-sm">Priority support</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                          </div>
                          <span className="text-sm">Custom branding</span>
                        </li>
                      </ul>
                      
                      <Button variant="default" className="w-full" disabled>
                        Coming Soon
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Stay tuned!</span> Subscription plans are coming soon. In the meantime, support us with a one-time donation.
                </p>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
      
      <DialogFooter>
        <Button variant="ghost" onClick={() => window.open('https://www.buymeacoffee.com', '_blank')}>
          Learn More
        </Button>
      </DialogFooter>
    </>
  );
};
