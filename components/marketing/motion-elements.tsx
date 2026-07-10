'use client';

import { motion, type Variants, type HTMLMotionProps } from 'framer-motion';
import { type ReactNode } from 'react';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 48 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const fadeUpFast: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -48 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const fadeRight: Variants = {
  hidden: { opacity: 0, x: 48 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const fadeDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const staggerFast: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

type MotionDivProps = HTMLMotionProps<'div'> & { children: ReactNode; className?: string };

export function FadeIn({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function FadeInFast({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div variants={fadeUpFast} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function FadeInLeft({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div variants={fadeLeft} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function FadeInRight({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div variants={fadeRight} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function FadeInDown({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div variants={fadeDown} initial="hidden" whileInView="visible" viewport={{ once: true }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function StaggerContainer({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function StaggerContainerFast({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div variants={staggerFast} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div variants={fadeUpFast} className={className} {...props}>
      {children}
    </motion.div>
  );
}
