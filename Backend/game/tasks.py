import random
from decimal import Decimal
from datetime import timedelta

from celery import shared_task
from django.utils import timezone
from django.db import transaction

from .models import BlockFeed


@shared_task(name="generate_block")
def generate_block():
    """Generate a new mining block every 30-120 seconds."""
    
    # Get the latest block number
    latest_block = BlockFeed.objects.order_by('-block_number').first()
    next_block_number = (latest_block.block_number + 1) if latest_block else 10000
    
    # Generate fake miner names
    miner_names = [
        f"Node_{random.randint(100, 999)}",
        f"Miner_{random.randint(1, 500)}",
        f"Phoenix_{random.randint(1, 200)}",
        f"Quantum_{random.randint(1, 150)}",
        f"Neural_{random.randint(1, 300)}",
        f"Crypto_{random.randint(1, 250)}",
        f"Block_{random.randint(1, 400)}",
        f"Hash_{random.randint(1, 350)}",
    ]
    
    # Sometimes use real user names (if they exist)
    from accounts.models import UserProfile
    real_users = list(UserProfile.objects.filter(
        is_mining=True
    ).values_list('first_name', flat=True)[:5])
    
    if real_users and random.random() < 0.3:  # 30% chance to use real user
        finder = random.choice(real_users)
    else:
        finder = random.choice(miner_names)
    
    # Generate block data
    block_hash = f"0x{format(random.randint(0, 0xFFFFFFFF), '08X')}"
    reward = round(random.uniform(2.5, 25.0), 2)
    difficulty = f"{random.randint(10, 80)}T"
    participants = random.randint(2, 12)
    
    # Create the block
    with transaction.atomic():
        BlockFeed.objects.create(
            block_number=next_block_number,
            block_hash=block_hash,
            reward=Decimal(str(reward)),
            finder=finder,
            difficulty=difficulty,
            participants=participants,
        )
    
    # Clean up old blocks (keep only last 100)
    old_blocks = BlockFeed.objects.order_by('-created_at')[100:]
    if old_blocks:
        BlockFeed.objects.filter(
            id__in=[b.id for b in old_blocks]
        ).delete()
    
    return f"Generated block #{next_block_number} by {finder} (+{reward} PUREX)"


@shared_task(name="cleanup_old_blocks")
def cleanup_old_blocks():
    """Clean up blocks older than 24 hours."""
    cutoff = timezone.now() - timedelta(hours=24)
    deleted_count = BlockFeed.objects.filter(created_at__lt=cutoff).count()
    BlockFeed.objects.filter(created_at__lt=cutoff).delete()
    return f"Cleaned up {deleted_count} old blocks"
