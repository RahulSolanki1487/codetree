using System;

namespace Sample.Api.Services;

/// <summary>Looks users up and changes them. See <see cref="IUserStore"/> for where they live.</summary>
[Serializable]
public partial class UserService : IUserService
{
    /// <summary>Finds one user by id, or nothing when there is none.</summary>
    [Obsolete]
    public async Task<User?> FindAsync(int id, CancellationToken ct) { return null; }

    public int Count => 3;

    public UserService(IUserStore store) { }

    /// <inheritdoc/>
    public void Save(User user) { }

    public string Name { get; set; }

    public class Cache
    {
        public void Clear() { }
    }
}

public interface IUserService
{
    /// <summary>Saves a user.</summary>
    void Save(User user);

    void Delete(int id);
}

/// <summary>A user as the API shows it.</summary>
public record User(int Id, string Name);

public enum Role { Admin, Guest }
