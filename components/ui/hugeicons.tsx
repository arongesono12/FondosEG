'use client';

/**
 * Iconos Hugeicons bajo nombres compatibles con Lucide.
 *
 * El lugar de `lucide-react` en las páginas y componentes del dashboard se
 * sustituye por este módulo: expone los mismos nombres de icono pero renderiza
 * el set `@hugeicons/core-free-icons` a través de `HugeiconsIcon` de
 * `@hugeicons/react`. Así los usos `<Icon className="h-5 w-5" />` siguen
 * funcionando sin tocar cada referencia.
 */

import { forwardRef } from 'react';
import type { SVGAttributes } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Activity01Icon,
  AddTeamIcon,
  Alert01Icon,
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpDownIcon,
  ArrowUpRight01Icon,
  BadgeCheckIcon,
  BanknoteIcon,
  BarChartIcon,
  BellIcon,
  BookOpen01Icon,
  Briefcase01Icon,
  Calendar01Icon,
  Camera01Icon,
  Cancel01Icon,
  CheckCheckIcon,
  CheckIcon,
  CheckmarkCircle01Icon,
  CheckmarkCircle02Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  ClipboardIcon,
  Clock01Icon,
  ClockHourThreeIcon,
  CodeIcon,
  Coins01Icon,
  CookieIcon,
  Copy01Icon,
  CreditCardIcon,
  DashboardSquare01Icon,
  DollarSignIcon,
  Download01Icon,
  ExternalLinkIcon,
  EyeIcon,
  Facebook01Icon,
  FileCheckIcon,
  FileDownIcon,
  FileTextIcon,
  FilterHorizontalIcon,
  GaugeIcon,
  GlobalIcon,
  HandCoinsIcon,
  HeadphonesIcon,
  HistoryIcon,
  Image01Icon,
  KeyRoundIcon,
  LandmarkIcon,
  LifebuoyIcon,
  Linkedin01Icon,
  LoaderCircleIcon,
  LockKeyholeIcon,
Logout01Icon,
  Mail01Icon,
  MailOpenIcon,
  MapPinIcon,
  MenuIcon,
  MessageSquareIcon,
  MessageSquareMoreIcon,
  MessageSquareWarningIcon,
  MonitorIcon,
  Moon01Icon,
  MoreHorizontalIcon,
  MousePointerClickIcon,
  NetworkIcon,
  NewspaperIcon,
  PackageIcon,
  PaletteIcon,
  PencilLineIcon,
  PhoneIcon,
  PieChartIcon,
  PlayIcon,
  PlusSignCircleIcon,
  PowerIcon,
  PrinterIcon,
  QrCodeIcon,
  QuoteIcon,
  ReceiptIcon,
  ReceiptTextIcon,
  RefreshIcon,
  RocketIcon,
  RotateCcwIcon,
  SaveIcon,
  Search01Icon,
  SendIcon,
  Settings01Icon,
  Settings02Icon,
  Shield01Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  Sun01Icon,
  Target01Icon,
  TestTube02Icon,
  TrashIcon,
  TrendingUpIcon,
  TwitterIcon,
  User02Icon,
  UserCogIcon,
  UserGroupIcon,
  Wallet01Icon,
  WalletCardsIcon,
  WebhookIcon,
  Wifi01Icon,
  WifiOff01Icon,
  XIcon,
  YoutubeIcon,
  ZapIcon,
} from '@hugeicons/core-free-icons';

type IconProps = Omit<SVGAttributes<SVGSVGElement>, 'strokeWidth' | 'size'> & {
  size?: number | string;
  strokeWidth?: number | string;
};

function createIcon(icon: IconSvgElement, name: string) {
  const Component = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size, strokeWidth, ...rest },
    ref,
  ) {
    return (
      <HugeiconsIcon
        ref={ref}
        icon={icon}
        size={size}
        strokeWidth={
          typeof strokeWidth === 'string' ? Number(strokeWidth) : strokeWidth
        }
        {...rest}
      />
    );
  });
  Component.displayName = name;
  return Component;
}

export const Activity = createIcon(Activity01Icon, 'Activity');
export const UserPlus = createIcon(AddTeamIcon, 'UserPlus');
export const AlertTriangle = createIcon(Alert01Icon, 'AlertTriangle');
export const AlertCircle = createIcon(AlertCircleIcon, 'AlertCircle');
export const ArrowLeft = createIcon(ArrowLeft01Icon, 'ArrowLeft');
export const ArrowRight = createIcon(ArrowRight01Icon, 'ArrowRight');
export const ArrowDownUp = createIcon(ArrowUpDownIcon, 'ArrowDownUp');
export const ArrowUpRight = createIcon(ArrowUpRight01Icon, 'ArrowUpRight');
export const BadgeCheck = createIcon(BadgeCheckIcon, 'BadgeCheck');
export const Banknote = createIcon(BanknoteIcon, 'Banknote');
export const BarChart3 = createIcon(BarChartIcon, 'BarChart3');
export const Bell = createIcon(BellIcon, 'Bell');
export const BookOpen = createIcon(BookOpen01Icon, 'BookOpen');
export const Briefcase = createIcon(Briefcase01Icon, 'Briefcase');
export const Calendar = createIcon(Calendar01Icon, 'Calendar');
export const CalendarDays = createIcon(Calendar01Icon, 'CalendarDays');
export const Camera = createIcon(Camera01Icon, 'Camera');
export const XCircle = createIcon(Cancel01Icon, 'XCircle');
export const CheckCheck = createIcon(CheckCheckIcon, 'CheckCheck');
export const Check = createIcon(CheckIcon, 'Check');
export const CheckCircle = createIcon(CheckmarkCircle01Icon, 'CheckCircle');
export const CheckCircle2 = createIcon(CheckmarkCircle02Icon, 'CheckCircle2');
export const ChevronDown = createIcon(ChevronDownIcon, 'ChevronDown');
export const ChevronRight = createIcon(ChevronRightIcon, 'ChevronRight');
export const CircleDollarSign = createIcon(CircleDollarSignIcon, 'CircleDollarSign');
export const Clipboard = createIcon(ClipboardIcon, 'Clipboard');
export const Clock = createIcon(Clock01Icon, 'Clock');
export const Clock3 = createIcon(ClockHourThreeIcon, 'Clock3');
export const Code2 = createIcon(CodeIcon, 'Code2');
export const Coins = createIcon(Coins01Icon, 'Coins');
export const Cookie = createIcon(CookieIcon, 'Cookie');
export const Copy = createIcon(Copy01Icon, 'Copy');
export const CreditCard = createIcon(CreditCardIcon, 'CreditCard');
export const LayoutDashboard = createIcon(DashboardSquare01Icon, 'LayoutDashboard');
export const DollarSign = createIcon(DollarSignIcon, 'DollarSign');
export const Download = createIcon(Download01Icon, 'Download');
export const ExternalLink = createIcon(ExternalLinkIcon, 'ExternalLink');
export const Eye = createIcon(EyeIcon, 'Eye');
export const Facebook = createIcon(Facebook01Icon, 'Facebook');
export const FileCheck2 = createIcon(FileCheckIcon, 'FileCheck2');
export const FileDown = createIcon(FileDownIcon, 'FileDown');
export const FileText = createIcon(FileTextIcon, 'FileText');
export const Filter = createIcon(FilterHorizontalIcon, 'Filter');
export const Gauge = createIcon(GaugeIcon, 'Gauge');
export const Globe = createIcon(GlobalIcon, 'Globe');
export const HandCoins = createIcon(HandCoinsIcon, 'HandCoins');
export const Headphones = createIcon(HeadphonesIcon, 'Headphones');
export const History = createIcon(HistoryIcon, 'History');
export const Image = createIcon(Image01Icon, 'Image');
export const KeyRound = createIcon(KeyRoundIcon, 'KeyRound');
export const Landmark = createIcon(LandmarkIcon, 'Landmark');
export const LifeBuoy = createIcon(LifebuoyIcon, 'LifeBuoy');
export const Linkedin = createIcon(Linkedin01Icon, 'Linkedin');
export const Loader2 = createIcon(LoaderCircleIcon, 'Loader2');
export const LockKeyhole = createIcon(LockKeyholeIcon, 'LockKeyhole');
export const LogOut = createIcon(Logout01Icon, 'LogOut');
export const Mail = createIcon(Mail01Icon, 'Mail');
export const MailOpen = createIcon(MailOpenIcon, 'MailOpen');
export const MapPin = createIcon(MapPinIcon, 'MapPin');
export const Menu = createIcon(MenuIcon, 'Menu');
export const MessageSquare = createIcon(MessageSquareIcon, 'MessageSquare');
export const MessagesSquare = createIcon(MessageSquareMoreIcon, 'MessagesSquare');
export const MessageSquareWarning = createIcon(MessageSquareWarningIcon, 'MessageSquareWarning');
export const Monitor = createIcon(MonitorIcon, 'Monitor');
export const Moon = createIcon(Moon01Icon, 'Moon');
export const MoreHorizontal = createIcon(MoreHorizontalIcon, 'MoreHorizontal');
export const MousePointerClick = createIcon(MousePointerClickIcon, 'MousePointerClick');
export const Network = createIcon(NetworkIcon, 'Network');
export const Newspaper = createIcon(NewspaperIcon, 'Newspaper');
export const Package = createIcon(PackageIcon, 'Package');
export const Palette = createIcon(PaletteIcon, 'Palette');
export const PencilLine = createIcon(PencilLineIcon, 'PencilLine');
export const Phone = createIcon(PhoneIcon, 'Phone');
export const PieChart = createIcon(PieChartIcon, 'PieChart');
export const Play = createIcon(PlayIcon, 'Play');
export const Plus = createIcon(PlusSignCircleIcon, 'Plus');
export const Power = createIcon(PowerIcon, 'Power');
export const Printer = createIcon(PrinterIcon, 'Printer');
export const QrCode = createIcon(QrCodeIcon, 'QrCode');
export const Quote = createIcon(QuoteIcon, 'Quote');
export const Receipt = createIcon(ReceiptIcon, 'Receipt');
export const ReceiptText = createIcon(ReceiptTextIcon, 'ReceiptText');
export const RefreshCw = createIcon(RefreshIcon, 'RefreshCw');
export const Rocket = createIcon(RocketIcon, 'Rocket');
export const RotateCcw = createIcon(RotateCcwIcon, 'RotateCcw');
export const Save = createIcon(SaveIcon, 'Save');
export const Search = createIcon(Search01Icon, 'Search');
export const Send = createIcon(SendIcon, 'Send');
export const Settings = createIcon(Settings01Icon, 'Settings');
export const Settings2 = createIcon(Settings02Icon, 'Settings2');
export const Shield = createIcon(Shield01Icon, 'Shield');
export const ShieldAlert = createIcon(ShieldAlertIcon, 'ShieldAlert');
export const ShieldCheck = createIcon(ShieldCheckIcon, 'ShieldCheck');
export const Smartphone = createIcon(SmartphoneIcon, 'Smartphone');
export const Sparkles = createIcon(SparklesIcon, 'Sparkles');
export const Sun = createIcon(Sun01Icon, 'Sun');
export const Target = createIcon(Target01Icon, 'Target');
export const TestTube2 = createIcon(TestTube02Icon, 'TestTube2');
export const Trash2 = createIcon(TrashIcon, 'Trash2');
export const TrendingUp = createIcon(TrendingUpIcon, 'TrendingUp');
export const Twitter = createIcon(TwitterIcon, 'Twitter');
export const User = createIcon(User02Icon, 'User');
export const UserCog = createIcon(UserCogIcon, 'UserCog');
export const Users = createIcon(UserGroupIcon, 'Users');
export const Wallet = createIcon(Wallet01Icon, 'Wallet');
export const WalletCards = createIcon(WalletCardsIcon, 'WalletCards');
export const Webhook = createIcon(WebhookIcon, 'Webhook');
export const Wifi = createIcon(Wifi01Icon, 'Wifi');
export const WifiOff = createIcon(WifiOff01Icon, 'WifiOff');
export const X = createIcon(XIcon, 'X');
export const Youtube = createIcon(YoutubeIcon, 'Youtube');
export const Zap = createIcon(ZapIcon, 'Zap');