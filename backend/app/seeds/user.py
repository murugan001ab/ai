from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.role import Role
from app.core.security import get_password_hash


async def seed_user(session: AsyncSession):

    result = await session.execute(
        select(User).where(
            User.email == "user1@zeekers.com"
        )
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        print("✅ User Already Exists")
        return

    role_result = await session.execute(
        select(Role).where(
            Role.name == "USER"
        )
    )

    user_role = role_result.scalar_one()

    super_admin = User(
        employee_id="EMP0004",
        name="User1",
        email="user1@zeekers.com",
        password=get_password_hash("user1@123"),
        role_id=user_role.id,
        is_active=True,
    )

    session.add(super_admin)

    await session.commit()

    print("✅ user Created")