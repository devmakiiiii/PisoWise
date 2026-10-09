'use client'

import * as React from 'react'
import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { cn } from '@/lib/utils'

/**
 * Toast notification primitives built on Base UI. A single global
 * `<Toaster />` (in the root layout) renders the queue; anywhere in the tree,
 * `const { add } = Toast.useToastManager()` enqueues a toast.
 */
const ToastProvider = ToastPrimitive.Provider

function ToastViewport({
  className,
  ...props
}: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'fixed top-0 right-0 z-[100] m-0 flex w-full max-w-[min(24rem,100vw)] list-none flex-col-reverse gap-2 p-4 outline-none',
        className
      )}
      {...props}
    />
  )
}

function Toast({
  className,
  ...props
}: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        'absolute right-0 z-[calc(100%-1)] w-[calc(100%-2rem)] select-none rounded-lg bg-popover bg-clip-padding px-3.5 py-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-all duration-200 ease-out data-ending-style:translate-x-4 data-starting-style:translate-x-4 data-[limited]:opacity-0 data-[expanded]:opacity-100 data-ending-style:opacity-0 data-starting-style:opacity-0 [&[data-ending-style]:not([data-limited]):[&[data-swipe-direction=left]]:translate-x-[calc(var(--toast-swipe-movement-x)-100%)] [&[data-ending-style]:not([data-limited]):[&[data-swipe-direction=right]]:translate-x-[calc(var(--toast-swipe-movement-x)+100%)] [&[data-ending-style]:not([data-limited]):[&[data-swipe-direction=up]]:translate-y-[calc(var(--toast-swipe-movement-y)-100%)] [&[data-ending-style]:not([data-limited]):[&[data-swipe-direction=down]]:translate-y-[calc(var(--toast-swipe-movement-y)+100%)]',
        className
      )}
      {...props}
    />
  )
}

function ToastContent({
  className,
  ...props
}: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn('overflow-hidden transition-opacity', className)}
      {...props}
    />
  )
}

function ToastTitle({
  className,
  ...props
}: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn('text-[0.875rem] font-medium', className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn('text-xs opacity-80', className)}
      {...props}
    />
  )
}

function ToastAction({
  className,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-md border border-transparent bg-transparent px-2 text-xs font-medium transition-all hover:bg-secondary',
        className
      )}
      {...props}
    />
  )
}

function ToastClose({
  className,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn(
        'absolute top-1 right-1 flex size-5 items-center justify-center rounded-xs opacity-60 transition-opacity hover:opacity-100',
        className
      )}
      toast-close=""
      {...props}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M0.707 0.707 L9.293 9.293 M9.293 0.707 L0.707 9.293"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </ToastPrimitive.Close>
  )
}

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
}
