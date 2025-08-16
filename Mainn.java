public class Mainn {
    public final int max = 4;
    public int[] arr = new int[max];
    public int F = -1;
    public int R = -1;

    public void enqueue(int data) {
        if (R == max - 1) {
            System.out.println("Overflow");
            return;
        }
        if (F == -1) F = 0;
        R++;
        arr[R] = data;
        System.out.println("Enqueued = " + data);
    }

    public void dequeue() {
        if (F == -1 || F > R) {
            System.out.println("Underflow");
            return;
        }
        int data = arr[F];
        System.out.println("Dequeued = " + data);
        F++;
        if (F > R) {
            F = -1;
            R = -1;
        }
    }

    public void printque(){
        if(F == -1) {
            System.out.println("Queue is empty");
            return;
        }
        System.out.print("Queue: ");
        for(int i = F; i <= R; i++) {
            System.out.print(arr[i]);
            if (i < R) System.out.print(" <- ");
        }
        System.out.println();
    }

    public static void main(String[] args) {
        Mainn q = new Mainn();
        q.enqueue(10);
        q.enqueue(20);
        q.enqueue(30);
        q.printque();
        q.dequeue();
        q.dequeue();
        q.dequeue();
        q.dequeue();
        
    }
}
 