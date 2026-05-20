from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.role import Role
from app.core.security import get_password_hash


async def seed_admin(session: AsyncSession):

    result = await session.execute(
        select(User).where(
            User.email == "admin@zeekers.com"
        )
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        print("✅ Admin Already Exists")
        return

    role_result = await session.execute(
        select(Role).where(
            Role.name == "ADMIN"
        )
    )

    admin_role = role_result.scalar_one()

    super_admin = User(
        employee_id="EMP0002",
        name="Admin",
        email="admin@zeekers.com",
        password=get_password_hash("admin@123"),
        role_id=admin_role.id,
        is_active=True,
    )

    session.add(super_admin)

    await session.commit()

    print("✅Admin Created")