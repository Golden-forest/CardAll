import React from 'react';
import { Button } from '@/components/ui/button';
import { usePayment } from '@/contexts/payment-context';
import { Gift } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DonationButtonProps {
  // Button variant (default, outline, ghost, etc.)
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';
  
  // Button size (sm, md, lg, icon)
  size?: 'sm' | 'md' | 'lg' | 'icon';
  
  // Button className
  className?: string;
}

export const DonationButton: React.FC<DonationButtonProps> = ({
  variant = 'ghost',
  size = 'sm',
  className
}) => {
  const { openModal } = usePayment();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`rounded-full w-10 h-10 p-0 flex items-center justify-center ${className}`}
          onClick={openModal}
        >
          <Gift className="h-4 w-4" />
          <span className="sr-only">Price</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Support Us</p>
      </TooltipContent>
    </Tooltip>
  );
};
