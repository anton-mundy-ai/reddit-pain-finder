# UI Component Library

Pain Finder's reusable component library for consistent dark mode UI.

## Quick Start

```tsx
import { 
  Card, CardHeader, CardTitle,
  Button, ButtonLink,
  Badge, SeverityBadge,
  StatCard, StatGrid,
  Modal, EmptyState
} from '../components/ui';
```

---

## Components

### Card
Container component with variants.

```tsx
<Card variant="default" padding="md" hover>
  Content here
</Card>

<CardLink to="/path" variant="glass">
  Clickable card
</CardLink>

<Card>
  <CardHeader action={<Button>Action</Button>}>
    <CardTitle subtitle="Subtitle text">Title</CardTitle>
  </CardHeader>
  Content
  <CardFooter>Footer content</CardFooter>
</Card>
```

| Prop | Values | Default |
|------|--------|---------|
| variant | `default` `glass` `bordered` `elevated` | default |
| padding | `none` `sm` `md` `lg` | md |
| hover | boolean | false |

---

### Button
Interactive button with variants.

```tsx
<Button variant="primary" size="md" loading={false}>
  Click me
</Button>

<Button icon={<Icon />} iconRight={<ChevronRight />}>
  With Icons
</Button>

<ButtonLink to="/path" variant="ghost">
  Link styled as button
</ButtonLink>

<IconButton variant="ghost" size="sm">
  <CloseIcon />
</IconButton>
```

| Prop | Values | Default |
|------|--------|---------|
| variant | `primary` `secondary` `ghost` `outline` `danger` | primary |
| size | `sm` `md` `lg` | md |
| loading | boolean | false |
| fullWidth | boolean | false |

---

### Badge
Inline label/tag component.

```tsx
<Badge variant="brand" size="md">Label</Badge>
<Badge variant="green" dot pulse>Active</Badge>
<Badge icon={<Icon />}>With icon</Badge>

// Preset badges
<SeverityBadge severity="critical" />
<MarketTierBadge tier="$1B" />
<StatusBadge status="hot" />
<CategoryBadge category="productivity" />
```

| Prop | Values | Default |
|------|--------|---------|
| variant | `brand` `blue` `green` `yellow` `orange` `red` `gray` `purple` `cyan` | gray |
| size | `sm` `md` `lg` | md |
| dot | boolean | false |
| pulse | boolean | false |

---

### Tabs
Tab navigation component.

```tsx
// Simple inline tabs
<SimpleTabs
  tabs={[
    { id: 'all', label: 'All', icon: '📊' },
    { id: 'active', label: 'Active' },
  ]}
  value={activeTab}
  onChange={setActiveTab}
/>

// Full tabs with content
<Tabs defaultValue="tab1">
  <TabsList>
    <Tab value="tab1">Tab 1</Tab>
    <Tab value="tab2">Tab 2</Tab>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

---

### Modal
Dialog/modal component.

```tsx
<Modal
  isOpen={open}
  onClose={() => setOpen(false)}
  title="Modal Title"
  size="md"
  footer={<Button onClick={handleSave}>Save</Button>}
>
  Modal content
</Modal>

<ConfirmDialog
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title="Delete item?"
  message="This action cannot be undone."
  variant="danger"
  confirmLabel="Delete"
/>
```

| Prop | Values | Default |
|------|--------|---------|
| size | `sm` `md` `lg` `xl` `full` | md |
| closeOnOverlay | boolean | true |
| closeOnEscape | boolean | true |

---

### StatCard
Dashboard stat display.

```tsx
<StatGrid cols={4}>
  <StatCard
    icon="📈"
    value="1,234"
    label="Total Users"
    sublabel="Last 30 days"
    variant="success"
    trend={{ value: 12, positive: true }}
  />
</StatGrid>
```

| Prop | Values | Default |
|------|--------|---------|
| variant | `default` `brand` `success` `warning` `danger` | default |
| size | `sm` `md` `lg` | md |

---

### EmptyState
Placeholder for empty content.

```tsx
<EmptyState
  icon="📭"
  title="No results"
  description="Try adjusting your filters."
  action={{ label: 'Clear filters', onClick: clearFilters }}
  secondaryAction={{ label: 'Learn more', href: '/docs' }}
/>

<ErrorState title="Failed to load" onRetry={refetch} />

<LoadingState title="Loading..." description="Fetching data" />
```

---

### Skeleton
Loading placeholders.

```tsx
<Skeleton className="h-8 w-32" />
<SkeletonText lines={3} />
<SkeletonCard />
<SkeletonRow />
<SkeletonStats count={4} />

<LoadingContainer loading={isLoading} skeleton={<SkeletonCard />}>
  <ActualContent />
</LoadingContainer>
```

---

### Sparkline
Mini charts.

```tsx
<Sparkline 
  data={[10, 20, 15, 25, 30]} 
  width={100} 
  height={30}
  showArea
  showDots
/>

<MiniBarChart data={[5, 8, 3, 12]} color="#8b5cf6" />

<ProgressRing value={75} max={100} size={40} showValue />
```

---

## CSS Classes

These CSS utility classes are available globally via `index.css`:

### Buttons
```html
<button class="btn btn-primary btn-md">Primary</button>
<button class="btn btn-secondary btn-sm">Secondary</button>
<button class="btn btn-ghost btn-lg">Ghost</button>
```

### Cards
```html
<div class="card">Default card</div>
<div class="card-hover">Hoverable card</div>
<div class="glass-card">Glass morphism</div>
```

### Badges
```html
<span class="badge badge-brand">Brand</span>
<span class="badge badge-green">Success</span>
```

### Forms
```html
<input class="input" placeholder="Text input" />
<select class="select">...</select>
```

### Tables
```html
<div class="table-container">
  <table class="table">...</table>
</div>
```

### Navigation
```html
<a class="nav-link nav-link-active">Active Link</a>
<div class="tab-group">
  <button class="tab tab-active">Tab 1</button>
</div>
```

---

## Design Tokens

CSS variables defined in `:root`:

```css
/* Brand colors */
--color-brand: 139 92 246;

/* Background shades (dark mode) */
--color-bg-primary: 10 10 18;      /* dark-900 */
--color-bg-secondary: 20 20 32;    /* dark-850 */
--color-bg-tertiary: 31 31 48;     /* dark-800 */
--color-bg-elevated: 42 42 64;     /* dark-750 */

/* Transitions */
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;
```

Tailwind custom colors: `dark-900`, `dark-850`, `dark-800`, `dark-750`, `dark-700`, `dark-600`, `dark-500`, `brand-{400-700}`
