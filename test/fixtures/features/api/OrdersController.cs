namespace Shop.Api;

/// <summary>Takes and shows orders.</summary>
[ApiController]
[Route("api/[controller]")]
public class OrdersController(OrderService orders, Microsoft.Extensions.Options.IOptions<Shop.Options> options) : ControllerBase
{
    /// <summary>Lists my orders.</summary>
    [HttpGet("mine")]
    public IActionResult Mine() => Ok();

    [HttpGet("{id:int}")]
    public IActionResult ById(int id) => Ok();

    [HttpPost]
    public IActionResult Place() => Ok(orders.Price());

    [HttpPost("/api/hooks/paid")]
    public IActionResult Paid() => Ok();

    public void NotAnEndpoint() { }
}

public class OrderService(Repo repo)
{
    public int Price() => repo.Load() + this.repo.Load();
}

public class Repo
{
    public int Load() => 1;
}
