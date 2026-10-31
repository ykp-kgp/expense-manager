import { useDb } from '@/lib/db-context';
import { Screen, Section, Row } from '@/components/ui';

export default function Categories() {
  const { categories } = useDb();
  return (
    <Screen scroll>
      <Section
        header="Categories"
        footer="Categories are predefined to keep things simple. Custom categories may come in a future update."
      >
        {categories.map((c) => (
          <Row
            key={c.id}
            title={c.name}
            icon={c.icon as any}
            iconBackground={c.color}
          />
        ))}
      </Section>
    </Screen>
  );
}
