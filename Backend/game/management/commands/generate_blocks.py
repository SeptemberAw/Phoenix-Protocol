from django.core.management.base import BaseCommand
from game.tasks import generate_block


class Command(BaseCommand):
    help = 'Manually generate mining blocks for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=5,
            help='Number of blocks to generate (default: 5)',
        )

    def handle(self, *args, **options):
        count = options['count']
        
        self.stdout.write(
            self.style.SUCCESS(f'Generating {count} blocks...')
        )
        
        for i in range(count):
            try:
                result = generate_block()
                self.stdout.write(
                    self.style.SUCCESS(f'✅ {result}')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Error generating block {i+1}: {e}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'✅ Successfully generated {count} blocks!')
        )
