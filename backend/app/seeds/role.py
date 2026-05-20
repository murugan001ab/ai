from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role


ROLES = [
    "SUPER_ADMIN",
    "ADMIN",
    "SUPERVISOR",
    "USER",
]


async def seed_roles(session: AsyncSession):

    for role_name in ROLES:

        result = await session.execute(
            select(Role).where(Role.name == role_name)
        )

        role = result.scalar_one_or_none()

        if not role:
            session.add(
                Role(
                    name=role_name,
                    description=f"{role_name} role"
                )
            )

    await session.commit()

    print("✅ Roles Seeded")