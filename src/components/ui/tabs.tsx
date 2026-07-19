import * as React from "react"
import { View, type ITouchEvent } from "@tarojs/components"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
} | null>(null)

const Tabs = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View> & {
      value?: string
      defaultValue?: string
      onValueChange?: (value: string) => void
  }
>(({ className, value: valueProp, defaultValue, onValueChange, ...props }, ref) => {
    const [valueState, setValueState] = React.useState<string | undefined>(defaultValue)
    const value = valueProp !== undefined ? valueProp : valueState

    const handleValueChange = (newValue: string) => {
        if (valueProp === undefined) {
            setValueState(newValue)
        }
        onValueChange?.(newValue)
    }

  return (
      <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
        <View
          ref={ref}
          className={cn(className)}
          {...props}
        />
    </TabsContext.Provider>
  )
})
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      "inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-500",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View> & {
      value: string
      disabled?: boolean
  }
>(({ className, value, onClick, disabled, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isActive = context?.value === value

    const handleClick = (e: ITouchEvent) => {
        if (disabled) return
        context?.onValueChange?.(value)
        onClick?.(e)
    }

  return (
    <View
      ref={ref}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1 text-sm font-medium ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        isActive && "bg-white text-primary shadow-sm",
        disabled && "opacity-50 pointer-events-none",
        className
        )}
      hoverClass={
        disabled
          ? undefined
          : "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background"
      }
      {...props}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View> & {
      value: string
  }
>(({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (context?.value !== value) return null

  return (
    <View
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
        className
      )}
      {...props}
    />
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
